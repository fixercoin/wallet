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

async function proxyToHelius(
  request: Request,
  env: Record<string, string | undefined>,
) {
  const apiKey = env.HELIUS_API_KEY;
  if (!apiKey) {
    const headers = applyCors(
      new Headers({ "Content-Type": "application/json" }),
    );
    return new Response(
      JSON.stringify({ error: "Missing HELIUS_API_KEY environment variable" }),
      { status: 500, headers },
    );
  }

  const heliusUrl = new URL("https://mainnet.helius-rpc.com/");
  heliusUrl.searchParams.set("api-key", apiKey);

  const response = await fetch(
    createForwardRequest(request, heliusUrl.toString()),
  );
  const headers = applyCors(new Headers(response.headers));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function proxyToApi(
  request: Request,
  env: Record<string, string | undefined>,
  path: string,
  search: string,
) {
  const requestOrigin = new URL(request.url).origin;
  const upstreamBase = (env.API_BASE_URL || "").trim() || requestOrigin;
  const targetUrl = new URL(`${path}${search}`, upstreamBase).toString();
  const response = await fetch(createForwardRequest(request, targetUrl));
  const headers = applyCors(new Headers(response.headers));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = async ({
  request,
  env,
}: {
  request: Request;
  env: Record<string, string | undefined>;
}) => {
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
    if (normalizedPath === "/helius") {
      return await proxyToHelius(request, env);
    }

    return await proxyToApi(request, env, normalizedPath, url.search);
  } catch (error) {
    console.error("Cloudflare API proxy error", error);
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
