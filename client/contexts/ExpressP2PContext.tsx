import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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

const DEFAULT_RATE = 292.59; // preserved default

export const ExpressP2PProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // No-op provider: provide safe defaults and avoid any network requests
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_RATE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isLoadingPrice] = useState(false);

  const handleSetExchangeRate = (rate: number) => {
    if (rate > 0 && !isNaN(rate)) setExchangeRate(rate);
  };

  const refreshExchangeRate = () => {
    // no-op
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
