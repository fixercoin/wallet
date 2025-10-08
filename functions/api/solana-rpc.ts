export const onRequestPost: PagesFunction = async (context) => {
  try {
    const ALCHEMY_URL =
      context.env.ALCHEMY_RPC_URL ||
      "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX";

    const body = await context.request.json();

    const response = await fetch(ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.text();
    return new Response(result, {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: 500, message: err.message || "RPC Proxy Error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
