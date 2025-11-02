export const onRequest: PagesFunction = async ({ request, env, url }) => {
  const inputMint = url.searchParams.get("inputMint");
  const outputMint = url.searchParams.get("outputMint");
  const amount = url.searchParams.get("amount"); // in smallest units

  if (!inputMint || !outputMint || !amount)
    return Response.json(
      { error: "inputMint, outputMint, amount required" },
      { status: 400 }
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

  // 1️⃣ Try Pump.fun
  const pumpQuote = await fetchQuote(env.PUMPFUN_QUOTE, { inputMint, outputMint, amount });
  if (pumpQuote) return Response.json({ source: "pumpfun", quote: pumpQuote });

  // 2️⃣ Try Meteora (replace with actual API if available)
  const meteoraUrl = "https://meteora-api.fake/quote"; // <-- put real Meteora URL
  const meteoraQuote = await fetchQuote(meteoraUrl, { inputMint, outputMint, amount });
  if (meteoraQuote) return Response.json({ source: "meteora", quote: meteoraQuote });

  // 3️⃣ Try Raydium (replace with real API endpoint)
  const raydiumUrl = "https://api.raydium.io/swap/quote"; // <-- put real Raydium quote endpoint
  const raydiumQuote = await fetchQuote(raydiumUrl, { inputMint, outputMint, amount });
  if (raydiumQuote) return Response.json({ source: "raydium", quote: raydiumQuote });

  // If all fail
  return Response.json({ error: "no_quote_available" }, { status: 502 });
};
