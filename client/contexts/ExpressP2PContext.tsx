import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { p2pPriceService } from "@/lib/services/p2p-price";

interface ExpressP2PContextType {
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  isAdmin: boolean;
  setIsAdmin: (admin: boolean) => void;
  isAdjusting: boolean;
  setIsAdjusting: (adjusting: boolean) => void;
  refreshExchangeRate: () => void;
  isLoadingPrice: boolean;
  markupPercentage: number;
}

const ExpressP2PContext = createContext<ExpressP2PContextType | undefined>(
  undefined,
);

const EXCHANGE_RATE_KEY = "express-exchange-rate";
const DEFAULT_RATE = 292.59; // 280.70 * 1.0425 (with 4.25% markup)

export const ExpressP2PProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_RATE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // Load exchange rate from localStorage and fetch real prices on mount
  useEffect(() => {
    const initializeExchangeRate = async () => {
      try {
        setIsLoadingPrice(true);

        // Clear old cache to force fresh price
        p2pPriceService.clearCache();

        // Try to get USDC price with 4.25% markup from DexScreener
        const price = await p2pPriceService.getTokenPrice("USDC");
        setExchangeRate(price);

        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(EXCHANGE_RATE_KEY, String(price));
        }

        console.log(
          `[ExpressP2P] Exchange rate initialized: ${price} PKR (with 4.25% markup)`,
        );
      } catch (error) {
        console.warn(
          "[ExpressP2P] Failed to fetch price from DexScreener, using default:",
          error,
        );

        // Fallback to localStorage or default
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem(EXCHANGE_RATE_KEY);
          if (saved) {
            const rate = Number(saved);
            if (!isNaN(rate) && rate > 0) {
              setExchangeRate(rate);
              return;
            }
          }
        }
        setExchangeRate(DEFAULT_RATE);
      } finally {
        setIsLoadingPrice(false);
      }
    };

    initializeExchangeRate();
  }, []);

  // Save exchange rate to localStorage when changed
  const handleSetExchangeRate = (rate: number) => {
    if (rate > 0 && !isNaN(rate)) {
      setExchangeRate(rate);
      if (typeof window !== "undefined") {
        localStorage.setItem(EXCHANGE_RATE_KEY, String(rate));
      }
    }
  };

  const refreshExchangeRate = async () => {
    try {
      setIsLoadingPrice(true);

      // Clear cache and fetch fresh price
      p2pPriceService.clearCache();
      const price = await p2pPriceService.getTokenPrice("USDC");
      setExchangeRate(price);

      if (typeof window !== "undefined") {
        localStorage.setItem(EXCHANGE_RATE_KEY, String(price));
      }

      console.log(`[ExpressP2P] Exchange rate refreshed: ${price} PKR`);
    } catch (error) {
      console.error("[ExpressP2P] Failed to refresh exchange rate:", error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  return (
    <ExpressP2PContext.Provider
      value={{
        exchangeRate,
        setExchangeRate: handleSetExchangeRate,
        isAdmin,
        setIsAdmin,
        isAdjusting,
        setIsAdjusting,
        refreshExchangeRate,
        isLoadingPrice,
        markupPercentage: 4.25,
      }}
    >
      {children}
    </ExpressP2PContext.Provider>
  );
};

export const useExpressP2P = () => {
  const context = useContext(ExpressP2PContext);
  if (!context) {
    throw new Error("useExpressP2P must be used within ExpressP2PProvider");
  }
  return context;
};
