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
import { jupiterAPI } from "@/lib/services/jupiter";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { solPriceService } from "@/lib/services/sol-price";
import { Connection } from "@solana/web3.js";
import { connection as globalConnection } from "@/lib/wallet";

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
  logout: () => void;
  updateWalletLabel: (publicKey: string, label: string) => void;
  connection?: Connection | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

const WALLETS_STORAGE_KEY = "solana_wallet_accounts";
const LEGACY_WALLET_KEY = "solana_wallet_data";

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
    if (wallet) {
      (async () => {
        await refreshBalance();
        await refreshTokens();
      })();

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      refreshIntervalRef.current = setInterval(async () => {
        await refreshBalance();
        await new Promise((r) => setTimeout(r, 500));
        await refreshTokens();
      }, 60000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Reset displayed balances immediately before switching
      setBalance(0);
      balanceRef.current = 0;
      setTokens(DEFAULT_TOKENS);

      setActivePublicKey(publicKey);
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
    if (!wallet) return;

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

      // Price fetching logic (same as before) - trimmed for brevity but preserved
      let prices: Record<string, number> = {};
      let priceSource = "fallback";
      let changeMap: Record<string, number> = {};

      try {
        const tokenMints = allTokens.map((token) => token.mint);
        try {
          let dexTokens: any[] = [];
          try {
            const dexPromise = dexscreenerAPI.getTokensByMints(tokenMints);
            const timeout = new Promise<any[]>((resolve) =>
              setTimeout(() => resolve([]), 4500),
            );
            dexTokens = await Promise.race([dexPromise, timeout]);
          } catch (fetchErr) {
            dexTokens = [];
          }

          if (Array.isArray(dexTokens) && dexTokens.length > 0) {
            try {
              prices = dexscreenerAPI.getTokenPrices(dexTokens);
            } catch (parseErr) {
              prices = {};
            }

            try {
              dexTokens.forEach((dt: any) => {
                const mint = dt?.baseToken?.address;
                const pc = dt?.priceChange;
                const candidates = [pc?.h24, pc?.h6, pc?.h1, pc?.m5];
                const ch = candidates.find(
                  (v: any) => typeof v === "number" && isFinite(v),
                );
                if (mint && typeof ch === "number") {
                  changeMap[mint] = ch;
                }
              });
            } catch (inner) {
              // noop
            }
          } else {
            prices = {};
          }

          // If SOL price is missing from DexScreener, don't throw immediately
          // Accept partial data and let Jupiter/CoinGecko fill in gaps
          const solMint = "So11111111111111111111111111111111111111112";
          const hasSufficientData =
            Object.keys(prices).length > 0 && prices[solMint];

          if (!hasSufficientData) {
            throw new Error(
              `DexScreener incomplete: got ${Object.keys(prices).length} prices`,
            );
          }
        } catch (dexErr) {
          console.warn("DexScreener error, continuing to Jupiter:", dexErr);
          prices = {};
        }

        // Fetch DexScreener data for stablecoins (USDC, USDT), FIXERCOIN, and LOCKER to get accurate prices and price changes
        const stableMints = allTokens
          .filter((t) => {
            const sym = (t.symbol || "").toUpperCase();
            const name = t.name || "";
            return (
              sym === "USDC" ||
              sym === "USDT" ||
              /USD\s*COIN/i.test(name) ||
              /TETHER/i.test(name)
            );
          })
          .map((t) => t.mint);

        const fixercoinMint = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
        const lockerMint = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";
        const mintsToFetch = [
          ...new Set(
            [...stableMints, fixercoinMint, lockerMint].filter(Boolean),
          ),
        ];

        if (mintsToFetch.length > 0) {
          try {
            const dexTokens =
              await dexscreenerAPI.getTokensByMints(mintsToFetch);
            const dexMap = new Map<string, any>();
            dexTokens.forEach((t) => {
              const matchMint = mintsToFetch.find(
                (m) =>
                  m === t.baseToken?.address || m === t.quoteToken?.address,
              );
              if (matchMint) dexMap.set(matchMint, t);
            });

            mintsToFetch.forEach((mint) => {
              const dexToken = dexMap.get(mint);
              if (dexToken) {
                // Update price if available
                if (dexToken.priceUsd) {
                  const price = parseFloat(dexToken.priceUsd);
                  if (price > 0) prices[mint] = price;
                }
                // Extract price change (h24 is preferred, fallback to h6, h1, m5)
                const pc = dexToken.priceChange || {};
                const candidates = [pc.h24, pc.h6, pc.h1, pc.m5];
                const priceChange = candidates.find(
                  (v: any) => typeof v === "number" && isFinite(v),
                );
                if (typeof priceChange === "number") {
                  changeMap[mint] = priceChange;
                  console.log(
                    `[Price Refresh] ${mint}: 24h change = ${priceChange.toFixed(2)}%`,
                  );
                }
              }
            });
          } catch (e) {
            console.warn(
              "Failed to fetch FIXERCOIN/LOCKER/stablecoin price data from DexScreener:",
              e,
            );
          }
        }

        // Try alternate source (CoinGecko via /api/stable-24h) for stablecoin 24h change
        try {
          const stableSymbols = allTokens
            .filter((t) => stableMints.includes(t.mint))
            .map((t) => (t.symbol || "").toUpperCase());
          const uniqSyms = Array.from(new Set(stableSymbols)).filter(Boolean);
          if (uniqSyms.length > 0) {
            const params = new URLSearchParams({ symbols: uniqSyms.join(",") });
            const resp = await fetch(
              `/api/stable-24h?${params.toString()}`,
            ).catch(() => new Response("", { status: 0 } as any));
            if (resp.ok) {
              const st = await resp.json();
              const data = st?.data || {};
              Object.keys(data).forEach((sym) => {
                const entry = data[sym];
                const mint = entry?.mint as string | undefined;
                const ch = entry?.change24h;
                const price = entry?.priceUsd;
                if (mint && typeof ch === "number" && isFinite(ch)) {
                  changeMap[mint] = ch;
                }
                if (mint && typeof price === "number" && price > 0) {
                  prices[mint] = price;
                }
              });
            }
          }
        } catch {}

        // Ensure stablecoins (USDC, USDT) always have a valid price and neutral change if still missing
        stableMints.forEach((mint) => {
          if (!prices[mint]) prices[mint] = 1;
          if (
            typeof changeMap[mint] !== "number" ||
            !isFinite(changeMap[mint]!)
          ) {
            changeMap[mint] = 0;
          }
        });

        // Ensure LOCKER always has a defined change value (fallback to 0 if unavailable)
        if (
          typeof changeMap[lockerMint] !== "number" ||
          !isFinite(changeMap[lockerMint]!)
        ) {
          changeMap[lockerMint] = 0;
        }

        const solMint = "So11111111111111111111111111111111111111112";
        if (Object.keys(prices).length > 0 && prices[solMint]) {
          priceSource = "dexscreener";
        } else {
          throw new Error(
            `DexScreener insufficient data: ${Object.keys(prices).length} prices, SOL missing: ${!prices[solMint]}`,
          );
        }
      } catch (dexError) {
        try {
          const tokenMints = allTokens.map((token) => token.mint);
          prices = await jupiterAPI.getTokenPrices(tokenMints);
          if (Object.keys(prices).length > 0) {
            priceSource = "jupiter";
          } else {
            throw new Error("Jupiter also returned no prices");
          }
        } catch (jupiterError) {
          try {
            const solPricePromise = solPriceService.getSolPrice();
            const timeout = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 3000),
            );
            const solPriceData = await Promise.race([solPricePromise, timeout]);
            prices = {
              So11111111111111111111111111111111111111112:
                solPriceData?.price || 100,
            };
            priceSource = solPriceData ? "coingecko" : "static";
          } catch {
            prices = { So11111111111111111111111111111111111111112: 100 };
            priceSource = "static";
          }
          try {
            const fixercoinPrice = await fixercoinPriceService.getPrice();
            prices["H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump"] =
              fixercoinPrice;
          } catch {}
        }
      }

      const enhancedTokens = allTokens.map((token) => {
        const price = prices[token.mint];
        let finalPrice = price;

        if (!finalPrice || finalPrice <= 0) {
          if (token.symbol === "SOL") {
            finalPrice = 100;
          } else if (
            token.mint === "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump"
          ) {
            finalPrice = 0.000023;
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

    if (wallet) refreshTokens();
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
