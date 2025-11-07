import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use GET.",
      }),
    };
  }

  try {
    const base = (event.queryStringParameters?.base || "USD").toUpperCase();
    const symbols = (
      event.queryStringParameters?.symbols || "PKR"
    ).toUpperCase();
    const firstSymbol = symbols.split(",")[0];

    const providers: Array<{
      url: string;
      parse: (j: any) => number | null;
    }> = [
      {
        url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
        parse: (j) =>
          j && typeof j[firstSymbol.toLowerCase()] === "number"
            ? j[firstSymbol.toLowerCase()]
            : null,
      },
    ];

    let lastErr = "";
    for (const p of providers) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(p.url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          lastErr = `${resp.status} ${resp.statusText}`;
          continue;
        }

        const json = await resp.json();
        const rate = p.parse(json);

        if (typeof rate === "number" && isFinite(rate) && rate > 0) {
          return {
            statusCode: 200,
            headers: {
              ...CORS_HEADERS,
              "Cache-Control": "public, max-age=300",
            },
            body: JSON.stringify({
              base,
              symbols: [firstSymbol],
              rates: { [firstSymbol]: rate },
            }),
          };
        }

        lastErr = "invalid response";
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch forex rate",
        details: lastErr,
      }),
    };
  } catch (error: any) {
    console.error("Forex RATE endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch forex rate",
        details: error?.message || String(error),
      }),
    };
  }
};
