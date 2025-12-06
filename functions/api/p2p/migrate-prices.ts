/**
 * Migration endpoint to add missing pricePKRPerQuote field to existing orders
 * POST /api/p2p/migrate-prices
 *
 * This migrates all orders that are missing the pricePKRPerQuote field
 * Sets them to 291.90 PKR per USDC (the correct market rate)
 */

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
}

function jsonResponse(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const CORRECT_PRICE = 291.9; // Current correct exchange rate
    let migratedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Get all order keys from KV
    const listResult = await env.STAKING_KV.list({ prefix: "orders:" });
    const keys = listResult.keys || [];

    for (const key of keys) {
      // Skip wallet index keys
      if (key.name.includes("wallet:")) continue;

      try {
        const orderJson = await env.STAKING_KV.get(key.name);
        if (!orderJson) continue;

        const order = JSON.parse(orderJson);

        // Only migrate if pricePKRPerQuote is missing or not set properly
        if (!order.pricePKRPerQuote || order.pricePKRPerQuote === 280) {
          const oldPrice = order.pricePKRPerQuote || "not set";

          order.pricePKRPerQuote = CORRECT_PRICE;
          order.migratedAt = Date.now();

          // Save updated order
          await env.STAKING_KV.put(key.name, JSON.stringify(order));
          migratedCount++;

          console.log(
            `[Migration] Updated ${key.name}: price changed from ${oldPrice} to ${CORRECT_PRICE}`,
          );
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${key.name}: ${errorMsg}`);
        errorCount++;
        console.error(`[Migration Error] ${key.name}:`, err);
      }
    }

    return jsonResponse(200, {
      success: true,
      message: "Migration completed",
      migratedCount,
      errorCount,
      totalProcessed: migratedCount + errorCount,
      errors: errors.length > 0 ? errors : undefined,
      priceUpdatedTo: CORRECT_PRICE,
    });
  } catch (error) {
    console.error("Error in migration:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: applyCors(new Headers()),
  });
};
