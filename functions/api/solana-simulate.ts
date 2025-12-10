export const onRequest: PagesFunction = async ({ request, env }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const txBase64: string | undefined =
    body?.signedBase64 || body?.signedTx || body?.signedTransaction || body?.tx;

  if (!txBase64 || typeof txBase64 !== "string") {
    return Response.json(
      {
        error: "Missing signed transaction (base64)",
        expected: ["signedBase64", "signedTx", "signedTransaction", "tx"],
      },
      { status: 400 },
    );
  }

  const candidateRpcs = [
    env.SOLANA_RPC as string,
    env.SOLANA_RPC_URL as string,
    env.MORALIS_RPC_URL as string,
    env.ALCHEMY_RPC_URL as string,
    "https://api.mainnet-beta.solflare.network",
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
    "https://solana.publicnode.com",
  ].filter((x) => !!x && typeof x === "string");

  const rpcBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "simulateTransaction",
    params: [
      txBase64,
      { encoding: "base64", replaceRecentBlockhash: true, sigVerify: true },
    ],
  };

  let lastErr: string = "";
  for (const rpcUrl of candidateRpcs) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await resp.json().catch(() => null);
      if (!json) {
        lastErr = `Invalid JSON from ${rpcUrl}`;
        continue;
      }
      // Pass-through simulation response
      return Response.json(json, { status: json.error ? 502 : 200 });
    } catch (e: any) {
      lastErr = e?.message || String(e);
      continue;
    }
  }

  return Response.json(
    {
      error: "rpc_simulate_failed",
      details: lastErr || "All RPC endpoints failed",
    },
    { status: 502 },
  );
};
