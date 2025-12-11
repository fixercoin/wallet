/**
 * SOL Balance Service
 * Provides utilities for fetching and displaying SOL balance
 * Uses the backend API endpoint: /api/wallet/balance?publicKey=<address>
 */

export interface BalanceResponse {
  publicKey: string;
  balance: number;
  balanceLamports: number;
  source: string;
}

/**
 * Fetch SOL balance for a wallet address from the backend API
 * @param publicKey - Solana wallet public key
 * @returns SOL balance in SOL (not lamports)
 * @throws Error if fetch fails
 */
export async function fetchSolBalance(publicKey: string): Promise<number> {
  if (!publicKey || typeof publicKey !== "string") {
    throw new Error("Invalid public key provided");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        `/api/wallet/balance?publicKey=${encodeURIComponent(publicKey)}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as BalanceResponse;

      if (data.error) {
        throw new Error(`API error: ${data.error}`);
      }

      const balance =
        data.balance !== undefined
          ? data.balance
          : data.balanceLamports !== undefined
            ? data.balanceLamports / 1_000_000_000
            : 0;

      if (typeof balance !== "number" || !isFinite(balance)) {
        throw new Error(`Invalid balance value: ${balance}`);
      }

      if (balance < 0) {
        throw new Error(`Negative balance: ${balance}`);
      }

      console.log(
        `[SolBalance] ✅ Fetched ${balance} SOL for ${publicKey.substring(0, 8)}...`,
      );
      return balance;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("[SolBalance] Failed to fetch balance:", error);
    throw error;
  }
}

/**
 * Format SOL balance for display
 * @param balance - Balance in SOL
 * @param decimals - Number of decimal places (default: 9)
 * @returns Formatted balance string
 */
export function formatSolBalance(
  balance: number,
  decimals: number = 9,
): string {
  if (typeof balance !== "number" || !isFinite(balance)) {
    return "0.000000000";
  }

  return balance.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
  });
}

/**
 * Display SOL balance with symbol
 * @param balance - Balance in SOL
 * @param decimals - Number of decimal places
 * @returns Formatted balance with SOL symbol
 */
export function displaySolBalance(
  balance: number,
  decimals: number = 9,
): string {
  return `${formatSolBalance(balance, decimals)} SOL`;
}
