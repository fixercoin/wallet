export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Forward ANY /api/ request to the Pages Functions runtime
    if (url.pathname.startsWith("/api/")) {
      const forwardUrl = "https://wallet-c36.pages.dev" + url.pathname + url.search;
      return fetch(new Request(forwardUrl, request));
    }

    // Serve front-end UI
    return env.ASSETS.fetch(request);
  }
};
