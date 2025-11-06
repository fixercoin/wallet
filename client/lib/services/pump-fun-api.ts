/**
 * Pump.fun API Integration
 * Directly implements the Pump.fun bonding curve trading endpoints
 * No Jupiter routing - pure Pump.fun token swapping
 */

const PUMP_CURVE_API = "https://pump.fun/api/curve";
const PUMP_BUY_API = "https://pump.fun/api/trade";
const PUMP_SELL_API = "https://pump.fun/api/sell";

export interface PumpCurveStatus {
  state: "active" | "graduated" | "closed";
  mint: string;
  curveProgress?: number;
  marketCapSOL?: number;
}

/**
 * Check if a token is on pump.fun bonding curve (OPEN state)
 * @param mint Token mint address
 * @returns true if curve is active/open, false if graduated/closed
 */
export async function checkCurveState(mint: string): Promise<boolean> {
  try {
    const res = await fetch(`${PUMP_CURVE_API}/${encodeURIComponent(mint)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.warn(`[Pump.fun] Curve check failed for ${mint}: ${res.status}`);
      return false;
    }

    const data = (await res.json()) as PumpCurveStatus;
    const isOpen = data.state === "active";

    console.log(`[Pump.fun] Token ${mint} curve state: ${data.state}`);
    return isOpen;
  } catch (error) {
    console.error(`[Pump.fun] Error checking curve state for ${mint}:`, error);
    return false;
  }
}

export interface PumpBuyRequest {
  mint: string;
  amount: number; // lamports (SOL)
  buyer: string; // public key
}

/**
 * Execute a Pump.fun BUY (SOL → TOKEN)
 * Returns unsigned transaction that must be signed by user
 * @param mint Token mint address
 * @param solAmount Amount in SOL (e.g., 0.5)
 * @param walletPublicKey User's public key
 * @returns Unsigned transaction in base64
 */
export async function pumpBuy(
  mint: string,
  solAmount: number,
  walletPublicKey: string,
): Promise<string> {
  try {
    const lamports = Math.floor(solAmount * 1_000_000_000);

    const requestBody: PumpBuyRequest = {
      mint,
      amount: lamports,
      buyer: walletPublicKey,
    };

    const res = await fetch(PUMP_BUY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(
        `Pump.fun BUY API error ${res.status}: ${errorText}`,
      );
    }

    const data = await res.json();

    if (!data?.transaction) {
      throw new Error(
        "Pump.fun BUY failed: No transaction in response",
      );
    }

    console.log(
      `[Pump.fun] BUY request successful: ${solAmount} SOL → ${mint}`,
    );
    return data.transaction; // base64 encoded transaction
  } catch (error) {
    console.error(`[Pump.fun] BUY error:`, error);
    throw error;
  }
}

export interface PumpSellRequest {
  mint: string;
  amount: number; // smallest units (token amount * 10^decimals)
  seller: string; // public key
}

/**
 * Execute a Pump.fun SELL (TOKEN → SOL)
 * Returns unsigned transaction that must be signed by user
 * @param mint Token mint address
 * @param tokenAmount Token amount in SMALLEST UNITS (no decimals!)
 * @param walletPublicKey User's public key
 * @returns Unsigned transaction in base64
 */
export async function pumpSell(
  mint: string,
  tokenAmount: number,
  walletPublicKey: string,
): Promise<string> {
  try {
    const requestBody: PumpSellRequest = {
      mint,
      amount: tokenAmount, // MUST be in smallest units
      seller: walletPublicKey,
    };

    const res = await fetch(PUMP_SELL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(
        `Pump.fun SELL API error ${res.status}: ${errorText}`,
      );
    }

    const data = await res.json();

    if (!data?.transaction) {
      throw new Error(
        "Pump.fun SELL failed: No transaction in response",
      );
    }

    console.log(
      `[Pump.fun] SELL request successful: ${tokenAmount} tokens → SOL`,
    );
    return data.transaction; // base64 encoded transaction
  } catch (error) {
    console.error(`[Pump.fun] SELL error:`, error);
    throw error;
  }
}
