const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, X-Requested-With";

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  headers.set("Vary", "Origin");
  return headers;
}

function createForwardRequest(request: Request, targetUrl: string) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(targetUrl, init);
}

// Choose which provider to use based on env vars
async function proxyToSolanaRPC(
  request: Request,
  env: Record<string, string | undefined>,
) {
  let rpcUrl = "";
  if (env.HELIUS_API_KEY) {
    rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  } else if (env.ALCHEMY_RPC_URL) {
    rpcUrl = env.ALCHEMY_RPC_URL;
  } else {
    // fallback or error
    const headers = applyCors(
      new Headers({ "Content-Type": "application/json" }),
    );
    return new Response(
      JSON.stringify({ error: "No Solana RPC endpoint configured." }),
      { status: 500, headers },
    );
  }

  const response = await fetch(createForwardRequest(request, rpcUrl));
  const headers = applyCors(new Headers(response.headers));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const rawPath = url.pathname.replace(/^\/api/, "") || "/";
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: applyCors(new Headers()),
    });
  }

  try {
    // Solana RPC proxy
    if (normalizedPath === "/solana-rpc") {
      return await proxyToSolanaRPC(request, env);
    }
    // ...other API routing
  } catch (error) {
    const headers = applyCors(
      new Headers({ "Content-Type": "application/json" }),
    );
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers,
    });
  }
};
