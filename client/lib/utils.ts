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
  if (!amount || isNaN(amount)) return "0.00";

  // Don't abbreviate certain tokens
  if (["SOL", "USDC", "FIXERCOIN", "LOCKER"].includes(symbol || "")) {
    return formatTokenAmount(amount, symbol);
  }

  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "M";
  }

  if (amount >= 1_000) {
    return (amount / 1_000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "K";
  }

  return formatTokenAmount(amount, symbol);
}
