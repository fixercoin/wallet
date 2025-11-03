import { Request, Response } from "express";

const BIRDEYE_API_KEY =
  process.env.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";
const BIRDEYE_API_URL = "https://public-api.birdeye.so";

export interface BirdeyePriceData {
  address: string;
  value: number;
  updateUnixTime: number;
  priceChange24h?: number;
}

export interface BirdeyePriceResponse {
  success: boolean;
  data?: BirdeyePriceData;
  error?: string;
}

export async function handleBirdeyePrice(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const address = (req.query.address as string) || "";

    if (!address) {
      res.status(400).json({
        success: false,
        error: "Missing 'address' parameter",
      });
      return;
    }

    const birdeyeUrl = `${BIRDEYE_API_URL}/public/price?address=${encodeURIComponent(address)}`;
    console.log(`[Birdeye] Fetching price for ${address} from ${birdeyeUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(birdeyeUrl, {
      headers: {
        Accept: "application/json",
        "X-API-KEY": BIRDEYE_API_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[Birdeye] API returned ${response.status} for address ${address}`,
      );
      const errorText = await response.text();
      console.warn(`[Birdeye] Error response: ${errorText}`);

      res.status(response.status).json({
        success: false,
        error: `Birdeye API returned ${response.status}`,
        details: errorText,
      });
      return;
    }

    const data: BirdeyePriceResponse = await response.json();

    if (!data.success || !data.data) {
      console.warn(`[Birdeye] No price data returned for ${address}`);
      res.status(200).json({
        success: false,
        error: "No price data available for this token",
      });
      return;
    }

    console.log(
      `[Birdeye] ✅ Got price for ${address}: $${data.data.value || "N/A"}`,
    );
    res.json(data);
  } catch (error: any) {
    console.error(
      `[Birdeye] Error fetching price:`,
      error?.message || String(error),
    );
    res.status(502).json({
      success: false,
      error: "Failed to fetch Birdeye price",
      details: error?.message || String(error),
    });
  }
}
