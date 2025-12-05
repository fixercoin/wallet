import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokenAmount(
  amount: number | string | undefined,
  symbol?: string,
): string {
  if (amount === undefined || amount === null) return "0.00";

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.00";

  // SOL and USDC always show exactly 4 decimal places
  if (symbol === "SOL" || symbol === "USDC") {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  // FIXERCOIN and LOCKER always show exactly 2 decimal places
  if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Default: 2-6 decimal places
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function formatAmountCompact(
  amount: number | undefined,
  symbol?: string,
): string {
  if (!amount || isNaN(amount)) {
    if (symbol === "SOL") {
      return "0.0000 SOL";
    }
    if (symbol === "USDC") {
      return "0.0000 USDC";
    }
    return symbol ? `0.00 ${symbol.toUpperCase()}` : "0.00";
  }

  // Only SOL and USDC use full format, all other tokens use abbreviation
  if (["SOL", "USDC"].includes(symbol || "")) {
    const formatted = formatTokenAmount(amount, symbol);
    return symbol ? `${formatted} ${symbol.toUpperCase()}` : formatted;
  }

  let formatted = "";

  if (amount >= 1_000_000_000) {
    formatted =
      (amount / 1_000_000_000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "B";
  } else if (amount >= 1_000_000) {
    formatted =
      (amount / 1_000_000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "M";
  } else if (amount >= 1_000) {
    formatted =
      (amount / 1_000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "K";
  } else {
    return formatTokenAmount(amount, symbol);
  }

  return symbol ? `${formatted} ${symbol.toUpperCase()}` : formatted;
}
