import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ExpressP2PContextType {
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  isAdmin: boolean;
  setIsAdmin: (admin: boolean) => void;
  isAdjusting: boolean;
  setIsAdjusting: (adjusting: boolean) => void;
  refreshExchangeRate: () => void;
}

const ExpressP2PContext = createContext<ExpressP2PContextType | undefined>(undefined);

const EXCHANGE_RATE_KEY = "express-exchange-rate";
const DEFAULT_RATE = 280;

export const ExpressP2PProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_RATE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Load exchange rate from localStorage on mount
  useEffect(() => {
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

  const refreshExchangeRate = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(EXCHANGE_RATE_KEY);
      if (saved) {
        const rate = Number(saved);
        if (!isNaN(rate) && rate > 0) {
          setExchangeRate(rate);
        }
      }
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
