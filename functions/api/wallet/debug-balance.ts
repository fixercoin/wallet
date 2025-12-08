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
  return new Response(
    JSON.stringify({
      message: "Debug: Environment Variables Check",
      hasSolanaRpcUrl: !!env?.SOLANA_RPC_URL,
      hasHeliusRpcUrl: !!env?.HELIUS_RPC_URL,
      hasHeliusApiKey: !!env?.HELIUS_API_KEY,
      hasAlchemyRpcUrl: !!env?.ALCHEMY_RPC_URL,
      hasMoralisRpcUrl: !!env?.MORALIS_RPC_URL,
      env: {
        SOLANA_RPC_URL: env?.SOLANA_RPC_URL ? "SET" : "NOT SET",
        HELIUS_RPC_URL: env?.HELIUS_RPC_URL ? "SET" : "NOT SET",
        HELIUS_API_KEY: env?.HELIUS_API_KEY ? "SET" : "NOT SET",
        ALCHEMY_RPC_URL: env?.ALCHEMY_RPC_URL ? "SET" : "NOT SET",
        MORALIS_RPC_URL: env?.MORALIS_RPC_URL ? "SET" : "NOT SET",
      },
      note: "Visit https://wallet.fixorium.com.pk/api/wallet/debug-balance to check if env vars are loaded",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
};
