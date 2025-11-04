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

  // FIXERCOIN and LOCKER always show minimum 2 decimal places
  if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }

  // Default: 2-6 decimal places
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}
