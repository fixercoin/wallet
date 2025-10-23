import { resolveApiUrl } from "@/lib/api-client";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";

export interface FixoriumSwapRateResponse {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  rate: number;
  priceImpact: string;
}

export interface FixoriumSwapExecuteRequest {
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
}

export interface FixoriumSwapExecuteResponse {
  transaction: string;
  swapId: string;
}

const FXM_MINT = TOKEN_MINTS.FXM;
const SOL_MINT = TOKEN_MINTS.SOL;

class FixoriumSwapService {
  /**
   * Check if a swap pair is FXM<->SOL
   */
  isFxmSolPair(mint1: string, mint2: string): boolean {
    return (
      (mint1 === FXM_MINT && mint2 === SOL_MINT) ||
      (mint1 === SOL_MINT && mint2 === FXM_MINT)
    );
  }

  /**
   * Get the swap rate for FXM<->SOL
   */
  async getSwapRate(
    inputMint: string,
    outputMint: string,
    inputAmount: string,
  ): Promise<FixoriumSwapRateResponse | null> {
    try {
      if (!this.isFxmSolPair(inputMint, outputMint)) {
        return null;
      }

      const apiUrl = resolveApiUrl();
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: inputAmount,
      });

      const response = await fetch(
        `${apiUrl}/api/fixorium-swap/rate?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        console.error(
          "Error fetching swap rate:",
          response.status,
          response.statusText,
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting Fixorium swap rate:", error);
      return null;
    }
  }

  /**
   * Execute a swap and get the transaction
   */
  async executeSwap(
    request: FixoriumSwapExecuteRequest,
  ): Promise<FixoriumSwapExecuteResponse | null> {
    try {
      if (!this.isFxmSolPair(request.inputMint, request.outputMint)) {
        return null;
      }

      const apiUrl = resolveApiUrl();
      const response = await fetch(`${apiUrl}/api/fixorium-swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        console.error(
          "Error executing swap:",
          response.status,
          response.statusText,
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error executing Fixorium swap:", error);
      return null;
    }
  }
}

export const fixoriumSwapAPI = new FixoriumSwapService();
