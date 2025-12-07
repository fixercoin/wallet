export const config = {
  runtime: "nodejs_esmsh",
};

interface Env {
  SOLANA_RPC_URL?: string;
  HELIUS_RPC_URL?: string;
  HELIUS_API_KEY?: string;
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
    "HELIUS_RPC_URL (from env param)": !!env?.HELIUS_RPC_URL,
    "HELIUS_API_KEY (from env param)": !!env?.HELIUS_API_KEY,
    "SOLANA_RPC_URL (from process.env)": !!process.env.SOLANA_RPC_URL,
    "HELIUS_RPC_URL (from process.env)": !!process.env.HELIUS_RPC_URL,
    "HELIUS_API_KEY (from process.env)": !!process.env.HELIUS_API_KEY,
    "NODE_ENV": process.env.NODE_ENV,
  };

  console.log("[Debug/Env] Environment status:", envStatus);

  return new Response(JSON.stringify(envStatus, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
