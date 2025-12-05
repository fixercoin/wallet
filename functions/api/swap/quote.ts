export const onRequest: PagesFunction = async ({ request, env, url }) => {
  const inputMint = url.searchParams.get("inputMint");
  const outputMint = url.searchParams.get("outputMint");
  const amount = url.searchParams.get("amount"); // in smallest units

  if (!inputMint || !outputMint || !amount)
    return Response.json(
      { error: "inputMint, outputMint, amount required" },
      { status: 400 },
    );

  const headers = { "Content-Type": "application/json" };

  // Helper function to fetch quote
  const fetchQuote = async (endpoint: string, body: any) => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  };

  // 1️⃣ Try Pump.fun if configured
  if (env.PUMPFUN_QUOTE) {
    const pumpQuote = await fetchQuote(env.PUMPFUN_QUOTE, {
      inputMint,
      outputMint,
      amount,
    });
    if (pumpQuote)
      return Response.json({ source: "pumpfun", quote: pumpQuote });
  }

  // 2️⃣ Try Jupiter (public API)
  try {
    const params = new URLSearchParams({ inputMint, outputMint, amount });
    const jupUrl = `https://quote-api.jup.ag/v6/quote?${params.toString()}`;
    const jupResp = await fetch(jupUrl, { method: "GET" });
    if (jupResp.ok) {
      const jupData = await jupResp.json();
      if (jupData && jupData.outAmount && jupData.outAmount !== "0") {
        return Response.json({ source: "jupiter", quote: jupData });
      }
    }
  } catch (e) {
    // ignore and fallback
  }

  // 3️⃣ Fallback: use DexScreener token price to return indicative USD-based quote
  try {
    const dexsUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(outputMint)}`;
    const dexsResp = await fetch(dexsUrl, { method: "GET" });
    if (dexsResp.ok) {
      const dexsData = await dexsResp.json();
      const priceUsd = Number(dexsData?.pairs?.[0]?.priceUsd) || null;
      if (priceUsd && priceUsd > 0) {
        // estimate out amount assuming input is SOL; convert amount (lamports) to SOL
        const solToLamports = 1_000_000_000n;
        const inLamports = BigInt(amount);
        const inSol = Number(inLamports) / Number(solToLamports);
        // use rough SOL price from DexScreener for SOL token
        const solDexsResp = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent("So11111111111111111111111111111111111111112")}`,
        );
        const solData = solDexsResp.ok ? await solDexsResp.json() : null;
        const solUsd = Number(solData?.pairs?.[0]?.priceUsd) || 0;
        if (solUsd > 0) {
          const estimatedOut = (inSol * solUsd) / priceUsd;
          return Response.json({
            source: "indicative",
            quote: { inAmount: Number(inSol), outEstimated: estimatedOut },
          });
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // If all fail
  return Response.json({ error: "no_quote_available" }, { status: 502 });
};
