import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useExpressP2P } from "./ExpressP2PContext";

type Fiat = "USD" | "PKR";

interface CurrencyContextType {
  currency: Fiat;
  setCurrency: (c: Fiat) => void;
  formatCurrency: (
    amount: number,
    opts?: { from?: "USD" | "PKR" | "AUTO"; minimumFractionDigits?: number },
  ) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

const PREFERRED_KEY = "preferred_currency";

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { exchangeRate } = useExpressP2P(); // PKR per USD
  const [currency, setCurrencyState] = useState<Fiat>(() => {
    try {
      const saved = (localStorage.getItem(PREFERRED_KEY) as Fiat) || "USD";
      return saved;
    } catch {
      return "USD";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFERRED_KEY, currency);
    } catch {}
  }, [currency]);

  const setCurrency = (c: Fiat) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(PREFERRED_KEY, c);
    } catch {}
  };

  const formatCurrency = (
    amount: number,
    opts?: { from?: "USD" | "PKR" | "AUTO"; minimumFractionDigits?: number },
  ) => {
    const from = opts?.from || "AUTO";
    if (!isFinite(amount) || amount == null) amount = 0;

    // Determine value in target currency
    let targetValue = amount;
    if (from === "AUTO") {
      // assume input amount is USD for typical token prices (>0 and often <1k) else if very large number maybe PKR
      // fallback: treat as USD
      targetValue = amount;
    } else if (from === "USD") {
      targetValue = amount;
    } else if (from === "PKR") {
      // convert PKR -> USD if needed later
      targetValue = amount / (exchangeRate || 1);
    }

    // If user's preferred currency is PKR convert USD->PKR
    if (currency === "PKR") {
      // ensure targetValue is USD, convert to PKR
      const inPkr = from === "PKR" ? amount : targetValue * (exchangeRate || 1);
      const digits =
        typeof opts?.minimumFractionDigits === "number"
          ? opts!.minimumFractionDigits
          : 2;
      return `PKR ${inPkr.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
    }

    // USD display
    const digits =
      typeof opts?.minimumFractionDigits === "number"
        ? opts!.minimumFractionDigits
        : 2;
    // If original provided from PKR, convert to USD for display
    const inUsd = from === "PKR" ? amount / (exchangeRate || 1) : targetValue;
    return `$${inUsd.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
