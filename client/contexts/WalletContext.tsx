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
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { lockerPriceService } from "@/lib/services/locker-price";
import { fxmPriceService } from "@/lib/services/fxm-price";
import { getTokenPriceBySol } from "@/lib/services/derived-price";
import { Connection } from "@solana/web3.js";
import { connection as globalConnection } from "@/lib/wallet";
import {
  savePricesToCache,
  saveBalanceToCache,
  getCachedBalance,
  saveTokensToCache,
  getCachedTokens,
} from "@/lib/services/offline-cache";
import {
  isEncryptedWalletStorage,
  decryptWalletData,
} from "@/lib/secure-storage";
import {
  setWalletPassword,
  getWalletPassword,
  isPasswordAvailable,
} from "@/lib/wallet-password";
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  hasValidWalletData,
  clearAllWalletData,
  getStorageDiagnostics,
} from "@/lib/wallet-persistence";

interface WalletContextType {
  wallet: WalletData | null; // active
  wallets: WalletData[]; // all accounts
  balance: number;
  tokens: TokenInfo[];
  isLoading: boolean;
  error: string | null;
  isUsingCache: boolean; // true when displaying cached data due to offline/network error
  requiresPassword: boolean; // true when wallets are encrypted and need unlock
  isInitialized: boolean; // true when wallet data has been loaded from storage
  setWallet: (wallet: WalletData | null) => void; // set active
  addWallet: (wallet: WalletData) => void; // add and select
  selectWallet: (publicKey: string) => void; // select existing
  refreshBalance: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  addCustomToken: (token: TokenInfo) => void;
  removeToken: (tokenMint: string) => void;
  logout: () => void;
  updateWalletLabel: (publicKey: string, label: string) => void;
  unlockWithPassword: (password: string) => Promise<boolean>;
  updateTokenBalance: (tokenMint: string, newBalance: number) => void;
  connection?: Connection | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

const WALLETS_STORAGE_KEY = "solana_wallet_accounts";
const LEGACY_WALLET_KEY = "solana_wallet_data";
const ACTIVE_WALLET_KEY = "solana_active_wallet";

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [activePublicKey, setActivePublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const balanceRef = useRef<number>(0);
  const [tokens, setTokens] = useState<TokenInfo[]>(DEFAULT_TOKENS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState<boolean>(false);
  const [requiresPassword, setRequiresPassword] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const encryptedWalletsRef = useRef<any[]>([]);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const providerRef = useRef<FixoriumWalletProvider | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

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
    const performInitialization = async () => {
      try {
        console.log("[WalletContext] Starting initialization...");
        console.log(
          "[WalletContext] Storage diagnostics:",
          getStorageDiagnostics(),
        );

        // Check legacy wallet first
        const legacy = getStorageItem(LEGACY_WALLET_KEY);
        if (legacy) {
          console.log(
            "[WalletContext] Found legacy wallet, migrating to new format...",
          );
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
                  for (let i = 0; i < bin.length; i++)
                    out[i] = bin.charCodeAt(i);
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
            setStorageItem(WALLETS_STORAGE_KEY, JSON.stringify([copy]));
            removeStorageItem(LEGACY_WALLET_KEY);
            console.log(
              "[WalletContext] ✅ Legacy wallet migrated successfully",
            );
          } catch (e) {
            console.warn("Failed to migrate legacy wallet to accounts key:", e);
          }
          hasInitializedRef.current = true;
          setIsInitialized(true);
          return;
        }

        // Try to load wallets using new persistence utilities
        const stored = getStorageItem(WALLETS_STORAGE_KEY);
        if (stored) {
          console.log("[WalletContext] Found stored wallets, parsing...");
          const parsed = JSON.parse(stored) as any[];

          // Validate that parsed is an array
          if (!Array.isArray(parsed) || parsed.length === 0) {
            console.warn(
              "[WalletContext] Invalid stored wallets format or empty array",
            );
            hasInitializedRef.current = true;
            setIsInitialized(true);
            return;
          }

          // Check if wallets are encrypted
          const firstWallet = parsed?.[0];
          if (firstWallet && isEncryptedWalletStorage(firstWallet)) {
            // Wallets are encrypted - store them and wait for password unlock
            console.log(
              "[WalletContext] Encrypted wallets detected, awaiting password",
            );
            encryptedWalletsRef.current = parsed;
            setRequiresPassword(true);
            hasInitializedRef.current = true;
            setIsInitialized(true);
            return;
          }

          // Load wallets as plaintext
          const coerced: WalletData[] = [];
          for (const p of parsed) {
            try {
              const obj = { ...p } as any;
              if (obj.secretKey && Array.isArray(obj.secretKey)) {
                obj.secretKey = Uint8Array.from(obj.secretKey);
              } else if (obj.secretKey && typeof obj.secretKey === "object") {
                const vals = Object.values(obj.secretKey).filter(
                  (v) => typeof v === "number",
                ) as number[];
                if (vals.length > 0) {
                  obj.secretKey = Uint8Array.from(vals);
                } else {
                  console.warn(
                    `[WalletContext] Could not parse secretKey for wallet ${obj.publicKey}`,
                  );
                  continue;
                }
              } else {
                console.warn(
                  `[WalletContext] No valid secretKey found for wallet ${obj.publicKey}`,
                );
                continue;
              }

              // Validate publicKey exists
              if (!obj.publicKey || typeof obj.publicKey !== "string") {
                console.warn("[WalletContext] Invalid publicKey in wallet");
                continue;
              }

              coerced.push(obj as WalletData);
            } catch (e) {
              console.warn(
                "[WalletContext] Failed to parse individual wallet:",
                e,
              );
              continue;
            }
          }

          if (coerced.length === 0) {
            console.warn(
              "[WalletContext] No valid wallets found after parsing. Clearing storage.",
            );
            clearAllWalletData();
            hasInitializedRef.current = true;
            setIsInitialized(true);
            return;
          }

          console.log(
            `[WalletContext] ✅ Loaded ${coerced.length} valid wallet(s) from storage`,
          );
          setWallets(coerced);

          // Restore active wallet from storage
          const savedActiveKey = getStorageItem(ACTIVE_WALLET_KEY);
          const activeWallet = savedActiveKey
            ? coerced.find((w) => w.publicKey === savedActiveKey)
            : coerced[0];

          if (activeWallet) {
            console.log(
              `[WalletContext] ✅ Setting active wallet: ${activeWallet.publicKey}`,
            );
            setActivePublicKey(activeWallet.publicKey);
          } else if (coerced.length > 0) {
            console.log(
              `[WalletContext] Saved active wallet not found, using first wallet`,
            );
            setActivePublicKey(coerced[0].publicKey);
          }
        } else {
          console.log(
            "[WalletContext] No wallets found in storage (new user or storage unavailable)",
          );
        }

        hasInitializedRef.current = true;
        setIsInitialized(true);
      } catch (error) {
        console.error("Error loading wallets from storage:", error);
        clearAllWalletData();
        hasInitializedRef.current = true;
        setIsInitialized(true);
      }
    };

    performInitialization();
  }, []);

  // Persist wallets whenever they change (but not before initial load)
  useEffect(() => {
    // Don't persist until we've finished initial load from localStorage
    if (!hasInitializedRef.current) {
      return;
    }

    try {
      if (wallets.length === 0) {
        removeStorageItem(WALLETS_STORAGE_KEY);
        console.log("[WalletContext] Wallets cleared from storage");
        return;
      }

      // Store wallets as plaintext (encryption disabled)
      const toStore = wallets.map((w) => {
        const copy: any = { ...w } as any;
        if (copy.secretKey instanceof Uint8Array)
          copy.secretKey = Array.from(copy.secretKey as Uint8Array);
        return copy;
      });

      const success = setStorageItem(
        WALLETS_STORAGE_KEY,
        JSON.stringify(toStore),
      );
      if (!success) {
        console.warn(
          "[WalletContext] ⚠️ Failed to persist wallets to any storage",
        );
      }
    } catch (e) {
      console.error("Failed to persist wallets:", e);
    }
  }, [wallets]);

  // Persist active wallet selection whenever it changes (but not before initial load)
  useEffect(() => {
    // Don't persist until we've finished initial load from localStorage
    if (!hasInitializedRef.current) {
      return;
    }

    try {
      if (activePublicKey) {
        const success = setStorageItem(ACTIVE_WALLET_KEY, activePublicKey);
        if (!success) {
          console.warn(
            `[WalletContext] ⚠️ Failed to persist active wallet to any storage`,
          );
        }
      } else {
        removeStorageItem(ACTIVE_WALLET_KEY);
      }
    } catch (e) {
      console.error("Failed to persist active wallet:", e);
    }
  }, [activePublicKey]);

  // Declare wallet first before using it in useEffect
  const wallet = wallets.find((w) => w.publicKey === activePublicKey) || null;

  // Ensure wallet has a proper secretKey format for operations that require signing
  const ensureWalletSecretKey = (w: WalletData | null): WalletData | null => {
    if (!w) return null;

    if (!w.secretKey) {
      console.warn(
        `[WalletContext] Wallet ${w.publicKey} does not have a secretKey. It may be a view-only wallet or improperly loaded.`,
      );
      return w;
    }

    // Ensure secretKey is Uint8Array
    if (w.secretKey instanceof Uint8Array) {
      return w;
    }

    try {
      let secretKeyArray: Uint8Array;
      if (Array.isArray(w.secretKey)) {
        secretKeyArray = Uint8Array.from(w.secretKey);
      } else if (typeof w.secretKey === "object") {
        const vals = Object.values(w.secretKey).filter(
          (v) => typeof v === "number",
        ) as number[];
        if (vals.length > 0) {
          secretKeyArray = Uint8Array.from(vals);
        } else {
          console.warn(
            `[WalletContext] Could not extract numeric values from secretKey object`,
          );
          return w;
        }
      } else {
        console.warn(
          `[WalletContext] Unexpected secretKey type: ${typeof w.secretKey}`,
        );
        return w;
      }

      return {
        ...w,
        secretKey: secretKeyArray,
      };
    } catch (e) {
      console.error(
        `[WalletContext] Failed to ensure secretKey format for wallet ${w.publicKey}:`,
        e,
      );
      return w;
    }
  };

  // Sync wallet with Fixorium provider
  useEffect(() => {
    const provider = providerRef.current ?? ensureFixoriumProvider();
    if (!provider) {
      console.warn("[WalletContext] Fixorium provider not available");
      return;
    }

    if (!wallet) {
      provider.setWallet(null);
      return;
    }

    // Ensure secretKey is properly formatted as Uint8Array before setting on provider
    try {
      let secretKey: Uint8Array;

      if (wallet.secretKey instanceof Uint8Array) {
        secretKey = wallet.secretKey;
      } else if (Array.isArray(wallet.secretKey)) {
        secretKey = Uint8Array.from(wallet.secretKey);
      } else if (typeof wallet.secretKey === "object") {
        const vals = Object.values(wallet.secretKey).filter(
          (v) => typeof v === "number",
        ) as number[];
        secretKey = Uint8Array.from(vals);
      } else {
        console.error(
          "[WalletContext] Unsupported secretKey format:",
          typeof wallet.secretKey,
        );
        return;
      }

      const walletToSet: WalletData = {
        ...wallet,
        secretKey,
      };

      provider.setWallet(walletToSet);
      console.log(
        `[WalletContext] Synced wallet with Fixorium provider: ${wallet.publicKey}`,
      );
    } catch (e) {
      console.error(
        "[WalletContext] Failed to sync wallet with Fixorium provider:",
        e,
      );
    }
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
        // Try to load cached data first for faster initial display
        const cachedTokens = getCachedTokens(wallet.publicKey);
        if (cachedTokens && cachedTokens.length > 0) {
          console.log("[WalletContext] Loading cached tokens on wallet switch");
          setTokens(cachedTokens);
          setIsUsingCache(true);
        }

        const cachedBalance = getCachedBalance(wallet.publicKey);
        if (cachedBalance !== null) {
          console.log(
            "[WalletContext] Loading cached balance on wallet switch",
          );
          setBalance(cachedBalance);
          balanceRef.current = cachedBalance;
        }

        // Then fetch fresh data
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

    // Setup periodic refresh every 5 seconds (adaptive based on visibility)
    const setupRefreshInterval = () => {
      // Auto-refresh dashboard every 30 seconds for live price updates
      const interval = 30000;

      refreshIntervalRef.current = setInterval(async () => {
        try {
          await refreshBalance();
          await new Promise((r) => setTimeout(r, 500));
          await refreshTokens();
        } catch (err) {
          console.error("[WalletContext] Error in periodic refresh:", err);
        }
      }, interval);
    };

    setupRefreshInterval();

    // No longer adjust polling based on visibility - use fixed 30-second interval
    const handleVisibilityChange = () => {
      // Visibility changes no longer trigger interval reconfiguration
      // Dashboard will refresh every 30 seconds consistently
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup on unmount or wallet change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [wallet?.publicKey]);

  const setWallet = (newWallet: WalletData | null) => {
    if (!newWallet) {
      console.log("[WalletContext] Clearing wallet and logout");
      setActivePublicKey(null);
      setBalance(0);
      balanceRef.current = 0;
      setTokens(DEFAULT_TOKENS);
      clearAllWalletData();
      return;
    }

    // Ensure secretKey is properly formatted
    const walletToAdd = ensureWalletSecretKey(newWallet) || newWallet;

    // Reset displayed balances/tokens immediately to avoid showing previous wallet data
    setBalance(0);
    balanceRef.current = 0;
    setTokens(DEFAULT_TOKENS);

    // If wallet already exists in list, just set active
    const exists = wallets.find((w) => w.publicKey === walletToAdd.publicKey);
    if (exists) {
      console.log(
        `[WalletContext] Wallet ${walletToAdd.publicKey} already exists, setting as active`,
      );
      setActivePublicKey(walletToAdd.publicKey);
      // Ensure active wallet is saved to storage
      try {
        setStorageItem(ACTIVE_WALLET_KEY, walletToAdd.publicKey);
        console.log(
          `[WalletContext] ✅ Active wallet saved: ${walletToAdd.publicKey}`,
        );
      } catch (e) {
        console.warn("Failed to save active wallet to storage:", e);
      }
      return;
    }

    // Add and set active
    const updatedWallets = [walletToAdd, ...wallets];
    console.log(
      `[WalletContext] Adding new wallet and setting as active: ${walletToAdd.publicKey}`,
    );
    setWallets(updatedWallets);
    setActivePublicKey(walletToAdd.publicKey);

    // Immediately save to storage to ensure persistence
    try {
      const toStore = updatedWallets.map((w) => {
        const copy: any = { ...w } as any;
        if (copy.secretKey instanceof Uint8Array) {
          copy.secretKey = Array.from(copy.secretKey as Uint8Array);
        }
        return copy;
      });

      const walletsSuccess = setStorageItem(
        WALLETS_STORAGE_KEY,
        JSON.stringify(toStore),
      );
      const activeSuccess = setStorageItem(
        ACTIVE_WALLET_KEY,
        walletToAdd.publicKey,
      );

      if (walletsSuccess && activeSuccess) {
        console.log(
          "[WalletContext] ✅ Wallet successfully saved to persistent storage:",
          walletToAdd.publicKey,
        );
      } else {
        console.warn(
          "[WalletContext] ⚠️ Partial save: wallets=" +
            walletsSuccess +
            ", active=" +
            activeSuccess,
        );
      }
    } catch (e) {
      console.error("[WalletContext] ❌ Failed to save wallet:", e);
    }
  };

  const addWallet = (newWallet: WalletData) => {
    // Ensure secretKey is properly formatted
    const walletToAdd = ensureWalletSecretKey(newWallet) || newWallet;

    // Check if wallet already exists
    const exists = wallets.find((w) => w.publicKey === walletToAdd.publicKey);

    let updatedWallets = wallets;
    if (!exists) {
      updatedWallets = [walletToAdd, ...wallets];
      setWallets(updatedWallets);
      console.log(`[WalletContext] New wallet added: ${walletToAdd.publicKey}`);
    } else {
      console.log(
        `[WalletContext] Wallet already exists, just setting as active: ${walletToAdd.publicKey}`,
      );
    }

    // Reset displayed balances to avoid flash of previous wallet
    setBalance(0);
    balanceRef.current = 0;
    setTokens(DEFAULT_TOKENS);

    setActivePublicKey(walletToAdd.publicKey);

    // Immediately save to storage
    try {
      const toStore = updatedWallets.map((w) => {
        const copy: any = { ...w } as any;
        if (copy.secretKey instanceof Uint8Array) {
          copy.secretKey = Array.from(copy.secretKey as Uint8Array);
        }
        return copy;
      });

      const walletsSuccess = setStorageItem(
        WALLETS_STORAGE_KEY,
        JSON.stringify(toStore),
      );
      const activeSuccess = setStorageItem(
        ACTIVE_WALLET_KEY,
        walletToAdd.publicKey,
      );

      if (walletsSuccess && activeSuccess) {
        console.log(
          "[WalletContext] ✅ Wallet added and saved to persistent storage:",
          walletToAdd.publicKey,
        );
      } else {
        console.warn(
          "[WalletContext] ⚠️ Partial save: wallets=" +
            walletsSuccess +
            ", active=" +
            activeSuccess,
        );
      }
    } catch (e) {
      console.error("[WalletContext] ❌ Failed to save wallet:", e);
    }
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

    // No loading state for balance - use fallback/cache silently
    setError(null);
    setIsUsingCache(false);

    try {
      const newBalance = await getBalance(wallet.publicKey);
      if (
        typeof newBalance === "number" &&
        !isNaN(newBalance) &&
        isFinite(newBalance) &&
        newBalance >= 0
      ) {
        setBalance(newBalance);
        balanceRef.current = newBalance;
        saveBalanceToCache(wallet.publicKey, newBalance);
      } else {
        console.warn("[WalletContext] Invalid balance value:", newBalance);
        setBalance(0);
        balanceRef.current = 0;
      }
    } catch (error) {
      console.error("Error refreshing balance:", error);

      // Try to use cached balance as fallback on network/RPC errors
      const cachedBalance = getCachedBalance(wallet.publicKey);
      if (
        cachedBalance !== null &&
        typeof cachedBalance === "number" &&
        isFinite(cachedBalance) &&
        cachedBalance >= 0
      ) {
        console.log(
          "[WalletContext] Using cached SOL balance as fallback:",
          cachedBalance,
        );
        setBalance(cachedBalance);
        balanceRef.current = cachedBalance;
        setIsUsingCache(true);
        setError(null);
      } else {
        console.warn(
          "[WalletContext] No valid cached balance available, showing 0",
        );
        setBalance(0);
        balanceRef.current = 0;
        setError("Unable to fetch SOL balance. Please check your connection.");
      }
    }
  };

  const refreshTokens = async () => {
    if (!wallet) {
      console.warn("[WalletContext] refreshTokens called but wallet is null");
      return;
    }

    // Clear price service caches to force fresh fetches
    fixercoinPriceService.clearCache();
    lockerPriceService.clearCache();
    fxmPriceService.clearCache();
    solPriceService.clearCache();

    console.log(
      `[WalletContext] Refreshing tokens for wallet: ${wallet.publicKey}`,
    );
    setError(null);

    try {
      // Fetch token accounts (balances) silently - no loading state
      const tokenAccounts = await getTokenAccounts(wallet.publicKey);

      // Check if SOL is already in tokenAccounts (new endpoint returns it with balance)
      const solFromTokenAccounts = tokenAccounts.find(
        (t) => t.symbol === "SOL",
      );

      // Use SOL from tokenAccounts if available and valid (for Cloudflare compatibility)
      // Otherwise use the balance from the separate refreshBalance() call
      let solBalance = 0;
      const tokenAccountsHasValidBalance =
        solFromTokenAccounts?.balance !== undefined &&
        typeof solFromTokenAccounts.balance === "number" &&
        isFinite(solFromTokenAccounts.balance) &&
        solFromTokenAccounts.balance >= 0;

      if (tokenAccountsHasValidBalance) {
        solBalance = solFromTokenAccounts.balance;
        setBalance(solFromTokenAccounts.balance);
        balanceRef.current = solFromTokenAccounts.balance;
        console.log(
          `[WalletContext] Updated SOL balance from tokenAccounts: ${solFromTokenAccounts.balance}`,
        );
      } else {
        // If we don't have a valid balance from tokenAccounts, try to fetch it directly
        // This ensures SOL balance is always correct, especially on Cloudflare
        if (
          typeof balanceRef.current !== "number" ||
          !isFinite(balanceRef.current) ||
          balanceRef.current < 0
        ) {
          console.log(
            "[WalletContext] Balance endpoint not yet fetched or invalid, fetching SOL balance directly",
          );
          try {
            const directBalance = await getBalance(wallet.publicKey);
            if (
              typeof directBalance === "number" &&
              isFinite(directBalance) &&
              directBalance >= 0
            ) {
              solBalance = directBalance;
              setBalance(directBalance);
              balanceRef.current = directBalance;
              console.log(
                `[WalletContext] Fetched SOL balance directly: ${directBalance} SOL`,
              );
            } else {
              console.warn(
                "[WalletContext] Direct balance fetch returned invalid value:",
                directBalance,
              );
              solBalance = 0;
            }
          } catch (err) {
            console.error(
              "[WalletContext] Failed to fetch SOL balance directly:",
              err,
            );
            solBalance = 0;
          }
        } else {
          // Use cached balance from earlier refreshBalance() call
          solBalance =
            typeof balanceRef.current === "number" &&
            isFinite(balanceRef.current) &&
            balanceRef.current >= 0
              ? balanceRef.current
              : balance || 0;
          console.log(
            `[WalletContext] Using SOL balance from balance endpoint: ${solBalance}`,
          );
        }
      }

      console.log(
        `[WalletContext] Creating allTokens array with SOL balance: ${solBalance} SOL`,
      );

      const allTokens: TokenInfo[] = [
        {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          logoURI:
            "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
          balance: solBalance,
        },
      ];

      tokenAccounts.forEach((tokenAccount) => {
        if (tokenAccount.symbol !== "SOL") {
          allTokens.push(tokenAccount);
        }
      });

      // Always include FXM, FIXERCOIN, and LOCKER tokens for display (even if user doesn't own them)
      const fxmMintAddress = "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump";
      const fixercoinMintAddress =
        "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
      const lockerMintAddress = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";

      const hasFXM = allTokens.some((t) => t.mint === fxmMintAddress);
      if (!hasFXM) {
        allTokens.push({
          mint: fxmMintAddress,
          symbol: "FXM",
          name: "Fixorium",
          decimals: 6,
          balance: 0,
          logoURI:
            "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2Fef8e21a960894d1b9408732e737a9d1f?format=webp&width=800",
        });
      }

      const hasFixercoin = allTokens.some(
        (t) => t.mint === fixercoinMintAddress,
      );
      if (!hasFixercoin) {
        allTokens.push({
          mint: fixercoinMintAddress,
          symbol: "FIXERCOIN",
          name: "FIXERCOIN",
          decimals: 6,
          balance: 0,
          logoURI:
            "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2F66c5cbe0ef78435eab9dfe4b45b5ba0d?format=webp&width=800",
        });
      }

      const hasLocker = allTokens.some((t) => t.mint === lockerMintAddress);
      if (!hasLocker) {
        allTokens.push({
          mint: lockerMintAddress,
          symbol: "LOCKER",
          name: "LOCKER",
          decimals: 6,
          balance: 0,
          logoURI:
            "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2Fb8e7b3fa19fe464c8362834eaf1367eb?format=webp&width=800",
        });
      }

      console.log(
        `[WalletContext] allTokens created with ${allTokens.length} tokens, SOL balance: ${
          allTokens[0]?.balance || "MISSING"
        } SOL`,
      );

      // Price fetching logic - show loader only during price fetch
      setIsLoading(true);
      let prices: Record<string, number> = {};
      let priceSource = "fallback";
      let changeMap: Record<string, number> = {};
      const solMint = "So11111111111111111111111111111111111111112";

      try {
        const tokenMints = allTokens.map((token) => token.mint);

        // Fetch prices from DexScreener API
        try {
          const allMintsToFetch = Array.from(
            new Set(tokenMints.filter(Boolean)),
          );

          if (allMintsToFetch.length > 0) {
            const dexTokens =
              await dexscreenerAPI.getTokensByMints(allMintsToFetch);
            const dexPrices = dexscreenerAPI.getTokenPrices(dexTokens);
            prices = { ...prices, ...dexPrices };

            dexTokens.forEach((token) => {
              const baseMint = token.baseToken?.address;
              if (baseMint && token.priceChange?.h24) {
                changeMap[baseMint] = token.priceChange.h24;
              }
            });
          }
        } catch (e) {
          console.warn("DexScreener fetch failed:", e);
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

        // Fetch FIXERCOIN, LOCKER, and FXM prices using specialized services
        const fixercoinMint = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
        const lockerMint = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";
        const fxmMint = "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump";

        try {
          // Fetch special token prices with timeout to prevent hanging
          const specialTokensPromise = Promise.all([
            fixercoinPriceService.getFixercoinPrice(),
            lockerPriceService.getLockerPrice(),
            fxmPriceService.getFXMPrice(),
          ]);

          // Timeout after 20 seconds - use what we have by then
          const timeoutPromise = new Promise<[any, any, any]>((resolve) =>
            setTimeout(() => {
              console.warn(
                "[WalletContext] Price fetching timeout after 20s, using partial results",
              );
              resolve([null, null, null]);
            }, 20000),
          );

          const [fixercoinData, lockerData, fxmData] = await Promise.race([
            specialTokensPromise,
            timeoutPromise,
          ]);

          if (
            fixercoinData &&
            fixercoinData.price > 0 &&
            isFinite(fixercoinData.price)
          ) {
            prices[fixercoinMint] = fixercoinData.price;
            changeMap[fixercoinMint] = fixercoinData.priceChange24h;
            console.log(
              `[WalletContext] ✅ FIXERCOIN price: $${fixercoinData.price.toFixed(8)} (24h: ${fixercoinData.priceChange24h.toFixed(2)}%) via ${fixercoinData.derivationMethod}`,
            );
          } else {
            console.warn(
              `[WalletContext] ⚠️ FIXERCOIN price fetch resulted in invalid price:`,
              fixercoinData,
            );
          }

          if (
            lockerData &&
            lockerData.price > 0 &&
            isFinite(lockerData.price)
          ) {
            prices[lockerMint] = lockerData.price;
            changeMap[lockerMint] = lockerData.priceChange24h;
            console.log(
              `[WalletContext] ✅ LOCKER price: $${lockerData.price.toFixed(8)} (24h: ${lockerData.priceChange24h.toFixed(2)}%) via ${lockerData.derivationMethod}`,
            );
          } else {
            console.warn(
              `[WalletContext] ⚠️ LOCKER price fetch resulted in invalid price:`,
              lockerData,
            );
          }

          if (fxmData && fxmData.price > 0 && isFinite(fxmData.price)) {
            prices[fxmMint] = fxmData.price;
            changeMap[fxmMint] = fxmData.priceChange24h;
            console.log(
              `[WalletContext] ✅ FXM price: $${fxmData.price.toFixed(8)} (24h: ${fxmData.priceChange24h.toFixed(2)}%) via ${fxmData.derivationMethod}`,
            );
          } else {
            console.warn(
              `[WalletContext] ⚠️ FXM price fetch resulted in invalid price:`,
              fxmData,
            );
          }
        } catch (e) {
          console.warn("❌ Failed to fetch FIXERCOIN/LOCKER/FXM prices:", e);
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

      // Use all tokens (removed localStorage-based hidden tokens filtering)
      const visibleTokens = allTokens;

      // Calculate SOL-based prices for tokens without valid prices
      const tokensNeedingPrices = visibleTokens.filter((token) => {
        const price = prices[token.mint];
        const isInvalid =
          typeof price !== "number" || !isFinite(price) || price <= 0;
        if (isInvalid) {
          console.log(
            `[WalletContext] Token ${token.symbol} (${token.mint}) needs price. Current: ${price}`,
          );
        }
        return isInvalid;
      });

      console.log(
        `[WalletContext] Token price analysis: ${visibleTokens.length} visible tokens, ${tokensNeedingPrices.length} need prices`,
      );

      if (tokensNeedingPrices.length > 0) {
        console.log(
          `[WalletContext] Calculating SOL-based prices for ${tokensNeedingPrices.length} tokens`,
        );
        const solMint = "So11111111111111111111111111111111111111112";
        const solPricePromises = tokensNeedingPrices.map(async (token) => {
          // Skip SOL itself
          if (token.mint === solMint) {
            return { mint: token.mint, price: null };
          }

          try {
            const priceData = await getTokenPriceBySol(
              token.mint,
              token.decimals,
            );
            if (priceData && priceData.tokenUsd > 0) {
              console.log(
                `[WalletContext] ✅ SOL-based price for ${token.symbol}: $${priceData.tokenUsd.toFixed(8)}`,
              );
              return { mint: token.mint, price: priceData.tokenUsd };
            }
          } catch (err) {
            console.warn(
              `[WalletContext] Failed to calculate SOL price for ${token.symbol}:`,
              err,
            );
          }
          return { mint: token.mint, price: null };
        });

        const calculatedPrices = await Promise.all(solPricePromises);
        calculatedPrices.forEach(({ mint, price }) => {
          const existingPrice = prices[mint];
          const hasValidPrice =
            typeof existingPrice === "number" &&
            isFinite(existingPrice) &&
            existingPrice > 0;
          if (price && price > 0 && !hasValidPrice) {
            prices[mint] = price;
            priceSource = "sol-derived";
            console.log(
              `[WalletContext] Updated price for ${mint} using SOL-derived pricing`,
            );
          }
        });
      }

      const enhancedTokens = visibleTokens.map((token) => {
        const price = prices[token.mint];
        // Only include price if it's a valid positive number
        // Otherwise leave it undefined so Dashboard shows loading state
        const finalPrice =
          typeof price === "number" && isFinite(price) && price > 0
            ? price
            : undefined;

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

      const solTokenInEnhanced = enhancedTokens.find((t) => t.symbol === "SOL");
      console.log(`[WalletContext] About to set tokens in state. SOL token:`, {
        symbol: solTokenInEnhanced?.symbol,
        balance: solTokenInEnhanced?.balance,
        price: solTokenInEnhanced?.price,
        mint: solTokenInEnhanced?.mint,
      });

      setTokens(enhancedTokens);
      setIsUsingCache(false);

      console.log(
        `[WalletContext] Tokens set in state. Total ${enhancedTokens.length} tokens`,
      );

      // Save tokens and prices to cache for offline support
      try {
        const cachedPrices: Record<string, any> = {};
        Object.entries(prices).forEach(([mint, price]) => {
          cachedPrices[mint] = {
            price,
            priceChange24h: changeMap[mint],
            timestamp: Date.now(),
          };
        });
        savePricesToCache(cachedPrices);
        saveTokensToCache(wallet.publicKey, enhancedTokens);
      } catch (cacheError) {
        console.warn(
          "[WalletContext] Failed to save to offline cache:",
          cacheError,
        );
      }
    } catch (error) {
      console.error("Error refreshing tokens:", error);

      // Try to load cached tokens first
      const cachedTokens = getCachedTokens(wallet.publicKey);
      if (cachedTokens && cachedTokens.length > 0) {
        console.log("[WalletContext] Using cached tokens due to network error");
        setTokens(cachedTokens);
        setIsUsingCache(true);
        setError("Using offline data - last updated earlier");

        // Also load cached balance when using cached tokens
        const cachedBalance = getCachedBalance(wallet.publicKey);
        if (cachedBalance !== null) {
          console.log(
            "[WalletContext] Also loading cached balance:",
            cachedBalance,
          );
          setBalance(cachedBalance);
          balanceRef.current = cachedBalance;
        }
      } else {
        setError(
          `Failed to fetch tokens: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Keep all tokens visible even if price fetching fails
        // Set balances to 0 for non-SOL tokens if we don't have data, but preserve token info
        const fallbackTokens: TokenInfo[] = [
          {
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Solana",
            decimals: 9,
            logoURI:
              "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
            balance:
              typeof balanceRef.current === "number"
                ? balanceRef.current
                : balance || 0,
          },
          {
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            symbol: "USDC",
            name: "USD Coin",
            decimals: 6,
            logoURI:
              "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
            balance: 0,
          },
          {
            mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
            symbol: "FIXERCOIN",
            name: "FIXERCOIN",
            decimals: 6,
            logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
            balance: 0,
          },
          {
            mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
            symbol: "LOCKER",
            name: "LOCKER",
            decimals: 6,
            logoURI:
              "https://i.postimg.cc/J7p1FPbm/IMG-20250425-004450-removebg-preview-modified-2-6.png",
            balance: 0,
          },
        ];

        setTokens(fallbackTokens);
        setIsUsingCache(false);
        console.log(
          "[WalletContext] Showing fallback tokens with zero balances while prices are unavailable",
        );
      }
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

    if (wallet) refreshTokens();
  };

  const removeToken = (tokenMint: string) => {
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

  const unlockWithPassword = async (password: string): Promise<boolean> => {
    try {
      if (
        !encryptedWalletsRef.current ||
        encryptedWalletsRef.current.length === 0
      ) {
        console.warn("[WalletContext] No encrypted wallets to unlock");
        return false;
      }

      // Try to decrypt wallets with provided password
      const decryptedWallets: WalletData[] = [];
      for (const encrypted of encryptedWalletsRef.current) {
        try {
          const decrypted = decryptWalletData(encrypted, password);
          decryptedWallets.push(decrypted);
        } catch (err) {
          console.warn("[WalletContext] Failed to decrypt wallet:", err);
          throw new Error("Incorrect password");
        }
      }

      // If we got here, password was correct
      setWalletPassword(password);
      setWallets(decryptedWallets);
      setRequiresPassword(false);
      if (decryptedWallets.length > 0) {
        setActivePublicKey(decryptedWallets[0].publicKey);
      }
      encryptedWalletsRef.current = [];
      console.log("[WalletContext] Wallets unlocked successfully");
      return true;
    } catch (error) {
      console.error("[WalletContext] Unlock error:", error);
      return false;
    }
  };

  const updateTokenBalance = (tokenMint: string, newBalance: number) => {
    setTokens((currentTokens) => {
      const updatedTokens = currentTokens.map((token) =>
        token.mint === tokenMint ? { ...token, balance: newBalance } : token,
      );

      // Persist updated tokens to cache immediately
      if (wallet?.publicKey) {
        try {
          saveTokensToCache(wallet.publicKey, updatedTokens);
        } catch (err) {
          console.warn(
            "[WalletContext] Failed to save updated tokens to cache:",
            err,
          );
        }
      }

      return updatedTokens;
    });
  };

  const value: WalletContextType = {
    wallet: ensureWalletSecretKey(wallet),
    wallets,
    balance,
    tokens,
    isLoading,
    error,
    isUsingCache,
    requiresPassword,
    isInitialized,
    setWallet,
    addWallet,
    selectWallet,
    refreshBalance,
    refreshTokens,
    addCustomToken,
    removeToken,
    logout,
    updateWalletLabel,
    unlockWithPassword,
    updateTokenBalance,
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
