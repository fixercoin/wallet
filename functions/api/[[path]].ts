export const config = {
  runtime: "nodejs_esmsh",
};

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Log the request
  console.log(`[API Handler] ${request.method} ${pathname}`);

  // Handle health check
  if (pathname === "/api/health" || pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: "cloudflare-pages",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Return 404 for unhandled routes
  return new Response(
    JSON.stringify({
      error: "API endpoint not found",
      path: pathname,
      message: "This endpoint has not been implemented. Please check the API documentation.",
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export default handler;
