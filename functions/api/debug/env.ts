export const config = {
  runtime: "nodejs_esmsh",
};

interface Env {
  SOLANA_RPC_URL?: string;
  ALCHEMY_RPC_URL?: string;
  MORALIS_RPC_URL?: string;
}

export const onRequest = async ({
  request,
  env,
}: {
  request: Request;
  env?: Env;
}) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const envStatus = {
    "SOLANA_RPC_URL (from env param)": !!env?.SOLANA_RPC_URL,
    "SOLANA_RPC_URL (from process.env)": !!process.env.SOLANA_RPC_URL,
    "ALCHEMY_RPC_URL (from env param)": !!env?.ALCHEMY_RPC_URL,
    "MORALIS_RPC_URL (from env param)": !!env?.MORALIS_RPC_URL,
    NODE_ENV: process.env.NODE_ENV,
    default_rpc: "https://api.mainnet-beta.solflare.network",
  };

  console.log("[Debug/Env] Environment status:", envStatus);

  return new Response(JSON.stringify(envStatus, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
