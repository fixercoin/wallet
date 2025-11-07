import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const FALLBACK_PRICE = {
  symbol: "SOL",
  price: 100,
  priceUsd: 100,
  priceChange24h: 0,
  volume24h: 0,
  marketCap: 0,
  liquidity: 0,
};

async function fetchFromDexScreener(): Promise<any> {
  const response = await fetch(
    "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
    {
      timeout: 5000,
    },
  );

  if (!response.ok) {
    throw new Error(
      `DexScreener returned status ${response.status}`,
    );
  }

  const data = await response.json();

  if (!data.pairs || data.pairs.length === 0) {
    throw new Error("No SOL pair data found");
  }

  const pair = data.pairs[0];
  const price = parseFloat(pair.priceUsd || "0");

  if (!isFinite(price) || price <= 0) {
    throw new Error("Invalid price from DexScreener");
  }

  return {
    symbol: "SOL",
    price: price,
    priceUsd: price,
    priceChange24h: parseFloat(pair.priceChange24h || "0") || 0,
    volume24h: parseFloat(pair.volume?.h24 || "0") || 0,
    marketCap: parseFloat(pair.marketCap || "0") || 0,
    liquidity: parseFloat(pair.liquidity?.usd || "0") || 0,
  };
}

async function fetchFromCoinGecko(): Promise<any> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true",
    {
      timeout: 5000,
    },
  );

  if (!response.ok) {
    throw new Error(
      `CoinGecko returned status ${response.status}`,
    );
  }

  const data = await response.json();

  if (!data.solana || !data.solana.usd) {
    throw new Error("No SOL price data from CoinGecko");
  }

  const price = parseFloat(data.solana.usd || "0");

  if (!isFinite(price) || price <= 0) {
    throw new Error("Invalid price from CoinGecko");
  }

  return {
    symbol: "SOL",
    price: price,
    priceUsd: price,
    priceChange24h: data.solana.usd_24h_change || 0,
    volume24h: data.solana.usd_24h_vol || 0,
    marketCap: data.solana.usd_market_cap || 0,
    liquidity: 0,
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Try multiple sources with fallback
  const strategies = [
    { name: "DexScreener", fn: fetchFromDexScreener },
    { name: "CoinGecko", fn: fetchFromCoinGecko },
  ];

  for (const strategy of strategies) {
    try {
      console.log(`[SOL Price] Trying ${strategy.name}...`);
      const data = await strategy.fn();
      console.log(`[SOL Price] Success from ${strategy.name}: ${data.price}`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.warn(
        `[SOL Price] ${strategy.name} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // All strategies failed, return fallback
  console.warn("[SOL Price] All strategies failed, returning fallback price");
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(FALLBACK_PRICE),
  };
};
