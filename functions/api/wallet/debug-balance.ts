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
  return new Response(
    JSON.stringify({
      message: "Debug: Environment Variables Check",
      hasSolanaRpcUrl: !!env?.SOLANA_RPC_URL,
      hasAlchemyRpcUrl: !!env?.ALCHEMY_RPC_URL,
      hasMoralisRpcUrl: !!env?.MORALIS_RPC_URL,
      env: {
        SOLANA_RPC_URL: env?.SOLANA_RPC_URL ? "SET" : "NOT SET",
        ALCHEMY_RPC_URL: env?.ALCHEMY_RPC_URL ? "SET" : "NOT SET",
        MORALIS_RPC_URL: env?.MORALIS_RPC_URL ? "SET" : "NOT SET",
      },
      note: "Using Solflare public RPC endpoint (https://api.mainnet-beta.solflare.network) as default",
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
