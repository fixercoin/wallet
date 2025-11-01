import { handleSolanaRpc } from "../server/routes/solana-proxy";

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/solana-rpc")) {
      return await handleSolanaRpc(req);
    }

    return new Response("Worker running OK", { status: 200 });
  },
};
