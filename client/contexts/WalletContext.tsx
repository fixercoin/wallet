import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import {
  WalletData,
  TokenInfo,
  getBalance,
  getTokenAccounts,
  DEFAULT_TOKENS,
} from "@/lib/wallet-proxy";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import type { FixoriumWalletProvider } from "@/lib/fixorium-provider";
import { solPriceService } from "@/lib/services/sol-price";
import { birdeyeAPI } from "@/lib/services/birdeye";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { lockerPriceService } from "@/lib/services/locker-price";
import { Connection } from "@solana/web3.js";
import { connection as globalConnection } from "@/lib/wallet";
import {
  encryptWalletData,
  decryptWalletData,
  isEncryptedWalletStorage,
  isPlaintextWalletStorage,
} from "@/lib/secure-storage";
import {
  getWalletPassword,
  setWalletPassword,
  markWalletAsPasswordProtected,
  doesWalletRequirePassword,
} from "@/lib/wallet-password";

interface WalletContextType {
  wallet: WalletData | null; // active
  wallets: WalletData[]; // all accounts
  balance: number;
  tokens: TokenInfo[];
  isLoading: boolean;
  error: string | null;
  setWallet: (wallet: WalletData | null) => void; // set active
  addWallet: (wallet: WalletData) => void; // add and select
  selectWallet: (publicKey: string) => void; // select existing
  refreshBalance: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  addCustomToken: (token: TokenInfo) => void;
  removeToken: (tokenMint: string) => void;
  logout: () => void;
  updateWalletLabel: (publicKey: string, label: string) => void;
  connection?: Connection | null;
  unlockWithPassword: (password: string) => Promise<boolean>; // Decrypt wallets with password
  needsPasswordUnlock: boolean; // True if wallets are encrypted but not unlocked
  setNeedsPasswordUnlock: (value: boolean) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

const WALLETS_STORAGE_KEY = "solana_wallet_accounts";
const LEGACY_WALLET_KEY = "solana_wallet_data";
const HIDDEN_TOKENS_KEY = "hidden_tokens";

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [activePublicKey, setActivePublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const balanceRef = useRef<number>(0);
  const [tokens, setTokens] = useState<TokenInfo[]>(DEFAULT_TOKENS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const providerRef = useRef<FixoriumWalletProvider | null>(null);
  const [needsPasswordUnlock, setNeedsPasswordUnlock] =
    useState<boolean>(false);
  const encryptedWalletsRef = useRef<any[]>([]);

  // Ensure Fixorium provider is available and wired once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const provider = ensureFixoriumProvider();
    if (!provider) return;
    providerRef.current = provider;
    provider.setDefaultConnection(globalConnection ?? null);

    return () => {
      provider.disconnect().catch(() => undefined);
      provider.setWallet(null);
    };
  }, []);

  // Load wallets from localStorage on mount (migrate legacy if necessary)
  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_WALLET_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as any;
        // try to coerce secretKey
        if (parsed && parsed.secretKey) {
          try {
            if (Array.isArray(parsed.secretKey)) {
              parsed.secretKey = Uint8Array.from(parsed.secretKey);
            } else if (typeof parsed.secretKey === "object") {
              const vals = Object.values(parsed.secretKey).filter(
                (v) => typeof v === "number",
              ) as number[];
              if (vals.length > 0) parsed.secretKey = Uint8Array.from(vals);
            } else if (typeof parsed.secretKey === "string") {
              try {
                const bin = atob(parsed.secretKey);
                const out = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
                parsed.secretKey = out;
              } catch {}
            }
          } catch (e) {
            console.warn("Failed to coerce legacy secretKey:", e);
          }
        }
        const single = parsed as WalletData;
        setWallets([single]);
        setActivePublicKey(single.publicKey);
        // migrate into new key
        try {
          const copy: any = { ...single } as any;
          if (copy.secretKey instanceof Uint8Array)
            copy.secretKey = Array.from(copy.secretKey as Uint8Array);
          localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify([copy]));
          localStorage.removeItem(LEGACY_WALLET_KEY);
        } catch (e) {
          console.warn("Failed to migrate legacy wallet to accounts key:", e);
        }
        return;
      }

      const stored = localStorage.getItem(WALLETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as any[];

        // Check if wallets are encrypted
        const firstWallet = parsed?.[0];
        if (isEncryptedWalletStorage(firstWallet)) {
          console.log("[WalletContext] Encrypted wallets detected");
          // Store encrypted wallets and mark as needing unlock
          encryptedWalletsRef.current = parsed;
          setNeedsPasswordUnlock(true);

          // Try to unlock with existing password if available
          const password = getWalletPassword();
          if (password) {
            try {
              const decrypted = parsed.map((enc) =>
                decryptWalletData(enc, password),
              );
              setWallets(decrypted);
              if (decrypted.length > 0)
                setActivePublicKey(decrypted[0].publicKey);
              setNeedsPasswordUnlock(false);
              console.log("[WalletContext] Wallets unlocked with stored password");
            } catch (e) {
              console.warn(
                "[WalletContext] Failed to unlock with stored password:",
                e,
              );
              setNeedsPasswordUnlock(true);
            }
          } else {
            console.log("[WalletContext] No password in session, awaiting unlock");
          }
        } else {
          // Plaintext wallets - coerce and load normally
          const coerced: WalletData[] = (parsed || []).map((p) => {
            const obj = { ...p } as any;
            if (obj.secretKey && Array.isArray(obj.secretKey)) {
              obj.secretKey = Uint8Array.from(obj.secretKey);
            } else if (obj.secretKey && typeof obj.secretKey === "object") {
              const vals = Object.values(obj.secretKey).filter(
                (v) => typeof v === "number",
              ) as number[];
              if (vals.length > 0) obj.secretKey = Uint8Array.from(vals);
            }
            return obj as WalletData;
          });
          setWallets(coerced);
          if (coerced.length > 0) setActivePublicKey(coerced[0].publicKey);
        }
      }
    } catch (error) {
      console.error("Error loading wallets from storage:", error);
      localStorage.removeItem(WALLETS_STORAGE_KEY);
    }
  }, []);

  // Persist wallets whenever they change
  useEffect(() => {
    try {
      const toStore = wallets.map((w) => {
        const copy: any = { ...w } as any;
        if (copy.secretKey instanceof Uint8Array)
          copy.secretKey = Array.from(copy.secretKey as Uint8Array);
        return copy;
      });
      if (toStore.length > 0) {
        localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(toStore));
      } else {
        localStorage.removeItem(WALLETS_STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to persist wallets:", e);
    }
  }, [wallets]);

  const wallet = wallets.find((w) => w.publicKey === activePublicKey) || null;

  useEffect(() => {
    const provider = providerRef.current ?? ensureFixoriumProvider();
    if (!provider) return;
    provider.setDefaultConnection(globalConnection ?? null);
    provider.setWallet(wallet);
  }, [wallet]);

  // Refresh balance and tokens when active wallet changes and setup auto-refresh
  useEffect(() => {
    if (!wallet) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    console.log(
      `[WalletContext] Wallet changed to ${wallet.publicKey}, refreshing data...`,
    );

    // Trigger immediate refresh
    const doRefresh = async () => {
      try {
        await refreshBalance();
        await new Promise((r) => setTimeout(r, 300));
        await refreshTokens();
      } catch (err) {
        console.error("[WalletContext] Error refreshing data:", err);
      }
    };

    doRefresh();

    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Setup periodic refresh every 10 seconds
    refreshIntervalRef.current = setInterval(async () => {
      try {
        await refreshBalance();
        await new Promise((r) => setTimeout(r, 500));
        await refreshTokens();
      } catch (err) {
        console.error("[WalletContext] Error in periodic refresh:", err);
      }
    }, 10000);

    // Cleanup on unmount or wallet change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [wallet?.publicKey]);

  const setWallet = (newWallet: WalletData | null) => {
    if (!newWallet) {
      setActivePublicKey(null);
      setBalance(0);
      balanceRef.current = 0;
      setTokens(DEFAULT_TOKENS);
      return;
    }

    // Reset displayed balances/tokens immediately to avoid showing previous wallet data
    setBalance(0);
    balanceRef.current = 0;
    setTokens(DEFAULT_TOKENS);

    // If wallet already exists in list, just set active
    const exists = wallets.find((w) => w.publicKey === newWallet.publicKey);
    if (exists) {
      setActivePublicKey(newWallet.publicKey);
      return;
    }

    // Add and set active
    setWallets((prev) => [newWallet, ...prev]);
    setActivePublicKey(newWallet.publicKey);
  };

  const addWallet = (newWallet: WalletData) => {
    // Avoid duplicates
    setWallets((prev) => {
      const exists = prev.find((w) => w.publicKey === newWallet.publicKey);
      if (exists) return prev;
      return [newWallet, ...prev];
    });

    // Reset displayed balances to avoid flash of previous wallet
    setBalance(0);
    balanceRef.current = 0;
    setTokens(DEFAULT_TOKENS);

    setActivePublicKey(newWallet.publicKey);
  };

  const selectWallet = (publicKey: string) => {
    const found = wallets.find((w) => w.publicKey === publicKey);
    if (found) {
      console.log(`[WalletContext] Selecting wallet: ${publicKey}`);

      // Immediately reset displayed balances and tokens when switching
      // This prevents showing old wallet's data while new data is loading
      setBalance(0);
      balanceRef.current = 0;
      setTokens(DEFAULT_TOKENS);
      setError(null);
      setIsLoading(true);

      // Set as active so other parts of the app update
      setActivePublicKey(publicKey);

      // Also proactively fetch balance & tokens for the selected publicKey
      (async () => {
        try {
          console.log(
            `[WalletContext] Proactively fetching balance for ${publicKey}`,
          );
          const newBalance = await getBalance(publicKey);
          if (typeof newBalance === "number" && !isNaN(newBalance)) {
            setBalance(newBalance);
            balanceRef.current = newBalance;
          } else {
            setBalance(0);
            balanceRef.current = 0;
          }
          // Refresh tokens based on the newly selected publicKey
          await refreshTokens();
        } catch (err) {
          console.error(
            "[WalletContext] Error selecting wallet and refreshing:",
            err,
          );
          setError("Failed to refresh selected wallet");
          setBalance(0);
          balanceRef.current = 0;
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      console.warn(
        `[WalletContext] Wallet not found: ${publicKey}. Available wallets:`,
        wallets.map((w) => w.publicKey),
      );
    }
  };

  const updateWalletLabel = (publicKey: string, label: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.publicKey === publicKey ? { ...w, label } : w)),
    );
  };

  const refreshBalance = async () => {
    if (!wallet) return;

    setIsLoading(true);
    setError(null);

    try {
      const newBalance = await getBalance(wallet.publicKey);
      if (typeof newBalance === "number" && !isNaN(newBalance)) {
        setBalance(newBalance);
        balanceRef.current = newBalance;
      } else {
        setBalance(0);
        balanceRef.current = 0;
      }
    } catch (error) {
      console.error("Error refreshing balance:", error);
      setError("Failed to refresh balance");
      setBalance(0);
      balanceRef.current = 0;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTokens = async () => {
    if (!wallet) {
      console.warn("[WalletContext] refreshTokens called but wallet is null");
      return;
    }

    console.log(
      `[WalletContext] Refreshing tokens for wallet: ${wallet.publicKey}`,
    );
    setError(null);
    setIsLoading(true);

    try {
      const tokenAccounts = await getTokenAccounts(wallet.publicKey);
      const customTokens = JSON.parse(
        localStorage.getItem("custom_tokens") || "[]",
      ) as TokenInfo[];

      const allTokens: TokenInfo[] = [
        {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          logoURI:
            "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
          balance: balanceRef.current || balance || 0,
        },
      ];

      tokenAccounts.forEach((tokenAccount) => {
        if (tokenAccount.symbol !== "SOL") {
          allTokens.push(tokenAccount);
        }
      });

      customTokens.forEach((customToken) => {
        const existingTokenIndex = allTokens.findIndex(
          (t) => t.mint === customToken.mint,
        );
        if (existingTokenIndex >= 0) {
          allTokens[existingTokenIndex] = {
            ...customToken,
            balance: allTokens[existingTokenIndex].balance,
          };
        } else {
          allTokens.push({ ...customToken, balance: 0 });
        }
      });

      // Price fetching logic
      let prices: Record<string, number> = {};
      let priceSource = "fallback";
      let changeMap: Record<string, number> = {};
      const solMint = "So11111111111111111111111111111111111111112";

      try {
        const tokenMints = allTokens.map((token) => token.mint);

        // Fetch prices from Birdeye API (via proxy)
        try {
          const allMintsToFetch = Array.from(
            new Set(tokenMints.filter(Boolean)),
          );

          if (allMintsToFetch.length > 0) {
            const birdeyeTokens =
              await birdeyeAPI.getTokensByMints(allMintsToFetch);
            const birdeyePrices = birdeyeAPI.getTokenPrices(birdeyeTokens);
            prices = { ...prices, ...birdeyePrices };

            birdeyeTokens.forEach((token) => {
              if (token.address && token.priceChange?.h24) {
                changeMap[token.address] = token.priceChange.h24;
              }
            });
          }
        } catch (e) {
          console.warn("Birdeye fetch failed:", e);
        }

        // Ensure stablecoins (USDC, USDT) always have a valid price and neutral change if still missing
        const stableMints = [
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns", // USDT
        ];
        stableMints.forEach((mint) => {
          if (!prices[mint]) prices[mint] = 1;
          if (
            typeof changeMap[mint] !== "number" ||
            !isFinite(changeMap[mint]!)
          ) {
            changeMap[mint] = 0;
          }
        });

        // Fetch FIXERCOIN and LOCKER prices using specialized services
        const fixercoinMint = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
        const lockerMint = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";

        try {
          const [fixercoinData, lockerData] = await Promise.all([
            fixercoinPriceService.getFixercoinPrice(),
            lockerPriceService.getLockerPrice(),
          ]);

          if (fixercoinData && fixercoinData.price > 0) {
            prices[fixercoinMint] = fixercoinData.price;
            changeMap[fixercoinMint] = fixercoinData.priceChange24h;
            console.log(
              `[WalletContext] FIXERCOIN price: $${fixercoinData.price.toFixed(8)} (24h: ${fixercoinData.priceChange24h.toFixed(2)}%)`,
            );
          }

          if (lockerData && lockerData.price > 0) {
            prices[lockerMint] = lockerData.price;
            changeMap[lockerMint] = lockerData.priceChange24h;
            console.log(
              `[WalletContext] LOCKER price: $${lockerData.price.toFixed(8)} (24h: ${lockerData.priceChange24h.toFixed(2)}%)`,
            );
          }
        } catch (e) {
          console.warn("Failed to fetch FIXERCOIN/LOCKER prices:", e);
        }

        // Ensure SOL price is always present - if birdeye didn't return it, fetch from dedicated endpoint
        if (!prices[solMint] || !isFinite(prices[solMint])) {
          console.log(
            "[WalletContext] SOL price missing from Birdeye, fetching from dedicated endpoint",
          );
          try {
            const solPricePromise = solPriceService.getSolPrice();
            const timeout = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 3000),
            );
            const solPriceData = await Promise.race([solPricePromise, timeout]);

            if (solPriceData && isFinite(solPriceData.price)) {
              prices[solMint] = solPriceData.price;
              if (
                typeof solPriceData.price_change_24h === "number" &&
                isFinite(solPriceData.price_change_24h)
              ) {
                changeMap[solMint] = solPriceData.price_change_24h;
              }
              console.log(
                `[WalletContext] SOL price from dedicated endpoint: $${solPriceData.price}`,
              );
            }
          } catch (e) {
            console.warn(
              "[WalletContext] Failed to fetch SOL from dedicated endpoint:",
              e,
            );
          }
        }

        if (Object.keys(prices).length > 0) {
          priceSource = "birdeye";
        } else {
          throw new Error(
            "No prices available from any source, using fallback",
          );
        }
      } catch (dexError) {
        console.warn(
          "[WalletContext] Price fetching failed, using static fallback:",
          dexError,
        );
        try {
          const solPricePromise = solPriceService.getSolPrice();
          const timeout = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 3000),
          );
          const solPriceData = await Promise.race([solPricePromise, timeout]);
          prices = {
            [solMint]: solPriceData?.price || 100,
          };
          if (
            solPriceData &&
            typeof solPriceData.price_change_24h === "number"
          ) {
            changeMap[solMint] = solPriceData.price_change_24h;
          }
          priceSource = solPriceData ? "coingecko" : "static";
        } catch {
          prices = { [solMint]: 100 };
          priceSource = "static";
        }
      }

      // Load hidden tokens list
      const hiddenTokens = JSON.parse(
        localStorage.getItem(HIDDEN_TOKENS_KEY) || "[]",
      ) as string[];

      // Filter out hidden tokens from allTokens
      const visibleTokens = allTokens.filter(
        (token) => !hiddenTokens.includes(token.mint),
      );

      const enhancedTokens = visibleTokens.map((token) => {
        const price = prices[token.mint];
        let finalPrice = price;

        if (!finalPrice || finalPrice <= 0) {
          if (token.symbol === "SOL") {
            finalPrice = 100;
          } else {
            finalPrice = 0;
          }
        }

        const change =
          typeof changeMap[token.mint] === "number"
            ? changeMap[token.mint]
            : undefined;

        return {
          ...token,
          price: finalPrice,
          priceChange24h: change,
        };
      });

      console.log(
        `[Wallet] Price source: ${priceSource} | SOL price: $${prices["So11111111111111111111111111111111111111112"] || "FALLBACK"}`,
      );
      setTokens(enhancedTokens);
    } catch (error) {
      console.error("Error refreshing tokens:", error);
      setError(
        `Failed to fetch tokens: ${error instanceof Error ? error.message : String(error)}`,
      );
      const fallbackTokens: TokenInfo[] = [
        {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          logoURI:
            "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
          balance: balance || 0,
          price: 100,
        },
        {
          mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
          symbol: "FIXERCOIN",
          name: "FIXERCOIN",
          decimals: 6,
          logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
          balance: 0,
          price: 0.000023,
        },
      ];

      setTokens(fallbackTokens);
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomToken = (token: TokenInfo) => {
    setTokens((currentTokens) => {
      const exists = currentTokens.some((t) => t.mint === token.mint);
      if (exists) return currentTokens;
      return [...currentTokens, token];
    });

    const customTokens = JSON.parse(
      localStorage.getItem("custom_tokens") || "[]",
    );
    const newCustomTokens = [
      ...customTokens.filter((t: TokenInfo) => t.mint !== token.mint),
      token,
    ];
    localStorage.setItem("custom_tokens", JSON.stringify(newCustomTokens));

    // If token was previously hidden, remove it from hidden tokens to ensure it becomes visible
    try {
      const hiddenTokens = JSON.parse(
        localStorage.getItem(HIDDEN_TOKENS_KEY) || "[]",
      ) as string[];
      const filtered = hiddenTokens.filter((m) => m !== token.mint);
      if (filtered.length !== hiddenTokens.length) {
        localStorage.setItem(HIDDEN_TOKENS_KEY, JSON.stringify(filtered));
      }
    } catch (e) {
      // ignore
    }

    if (wallet) refreshTokens();
  };

  const removeToken = (tokenMint: string) => {
    // Remove from custom tokens if it exists there
    const customTokens = JSON.parse(
      localStorage.getItem("custom_tokens") || "[]",
    ) as TokenInfo[];
    const newCustomTokens = customTokens.filter(
      (t: TokenInfo) => t.mint !== tokenMint,
    );
    localStorage.setItem("custom_tokens", JSON.stringify(newCustomTokens));

    // Add to hidden tokens list to permanently hide it
    const hiddenTokens = JSON.parse(
      localStorage.getItem(HIDDEN_TOKENS_KEY) || "[]",
    ) as string[];
    if (!hiddenTokens.includes(tokenMint)) {
      hiddenTokens.push(tokenMint);
      localStorage.setItem(HIDDEN_TOKENS_KEY, JSON.stringify(hiddenTokens));
    }

    // Update state immediately
    setTokens((currentTokens) =>
      currentTokens.filter((t) => t.mint !== tokenMint),
    );
  };

  const logout = () => {
    // Clear active selection
    setActivePublicKey(null);
    setBalance(0);
    balanceRef.current = 0;
    setTokens(DEFAULT_TOKENS);
  };

  const value: WalletContextType = {
    wallet,
    wallets,
    balance,
    tokens,
    isLoading,
    error,
    setWallet,
    addWallet,
    selectWallet,
    refreshBalance,
    refreshTokens,
    addCustomToken,
    removeToken,
    logout,
    updateWalletLabel,
    connection: globalConnection,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
