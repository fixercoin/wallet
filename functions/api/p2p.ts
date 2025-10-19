// This file handles all P2P API endpoints (Builder.io + Cloudflare Worker)
import {
  listPosts,
  getPost,
  createOrUpdatePost,
  listTradeMessages,
  listRecentTradeMessages,
  addTradeMessage,
  uploadProof,
  deletePost,
} from "../../utils/p2pStore";
import {
  listPostsCF,
  getPostCF,
  createOrUpdatePostCF,
  listTradeMessagesCF,
  listRecentTradeMessagesCF,
  addTradeMessageCF,
  recordProofCF,
  deletePostCF,
} from "../../utils/p2pStoreCf";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function uploadProofToSupabase(
  env: Record<string, string | undefined> | undefined,
  tradeId: string,
  proof: { filename: string; data: string },
) {
  const url = env?.SUPABASE_URL;
  const key = env?.SUPABASE_ANON_KEY || env?.SUPABASE_KEY;
  if (!url || !key)
    return { ok: false, error: "Supabase not configured" } as const;

  try {
    const base64 = proof.data.includes(",")
      ? proof.data.split(",").pop()!
      : proof.data;
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const objectPath = `p2p-proofs/${encodeURIComponent(tradeId)}/${Date.now()}-${proof.filename}`;
    const endpoint = `${url.replace(/\/$/, "")}/storage/v1/object/${objectPath}`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: binary,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return {
        ok: false,
        error: `Supabase upload failed: ${resp.status} ${resp.statusText} ${txt}`,
      } as const;
    }

    const publicUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/${objectPath}`;
    return { ok: true, url: publicUrl } as const;
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) } as const;
  }
}

async function commitPostsToGitHub(
  env: Record<string, string | undefined> | undefined,
  postsData: any,
) {
  try {
    const token =
      env?.GITHUB_TOKEN || env?.GITHUB_PAT || env?.GITHUB_TOKEN_SECRET;
    const repo = env?.GITHUB_REPO || "fixercoin/wallet"; // owner/repo
    const branch = env?.GITHUB_BRANCH || "zen-works";
    if (!token) return { ok: false, error: "no_github_token" } as const;
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName)
      return { ok: false, error: "invalid_repo" } as const;
    const filePath = "data/p2p-store.json";
    const content = JSON.stringify(postsData, null, 2);
    const base64Content = Buffer.from(content).toString("base64");

    const getUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    let sha: string | undefined;
    try {
      const getResp = await fetch(getUrl, { headers });
      if (getResp.ok) {
        const data = await getResp.json().catch(() => null);
        sha = data?.sha;
      }
    } catch {}

    const putUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(filePath)}`;
    const body: any = {
      message: `Update p2p posts ${new Date().toISOString()}`,
      content: base64Content,
      branch,
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(putUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!putResp.ok) {
      const txt = await putResp.text().catch(() => "");
      return {
        ok: false,
        error: `github_put_failed ${putResp.status} ${txt}`,
      } as const;
    }

    return { ok: true } as const;
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) } as const;
  }
}

export default async function (
  request: Request,
  env?: Record<string, string | undefined>,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,X-Admin-Wallet",
      },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/api\/p2p/, "");
  const db: any = (env as any)?.FIXORIUM_WALLET_DB;
  const hasDb = !!db && typeof db.prepare === "function";

  try {
    if (request.method === "GET" && (path === "/list" || path === "/")) {
      const data = hasDb ? await listPostsCF(db) : listPosts();
      return jsonResponse(data);
    }

    if (request.method === "GET" && path === "/export") {
      const data = hasDb ? await listPostsCF(db) : listPosts();
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="p2p-posts.json"',
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (request.method === "GET" && path.startsWith("/post/")) {
      const id = path.replace("/post/", "");
      const post = hasDb ? await getPostCF(db, id) : getPost(id);
      if (!post) return jsonResponse({ error: "not found" }, 404);
      return jsonResponse({ post });
    }

    if (request.method === "DELETE" && path.startsWith("/post/")) {
      const id = path.replace("/post/", "");
      const adminHeader = request.headers.get("x-admin-wallet") || "";
      const result = hasDb
        ? await deletePostCF(db, id, adminHeader)
        : deletePost(id, adminHeader);
      if ("error" in result)
        return jsonResponse(result, result.status || 400);
      return jsonResponse({ ok: true }, result.status || 200);
    }

    if (
      (request.method === "POST" || request.method === "PUT") &&
      path === "/post"
    ) {
      const body = await request.json().catch(() => null);
      const adminHeader =
        request.headers.get("x-admin-wallet") || body?.adminWallet || "";
      const result = hasDb
        ? await createOrUpdatePostCF(db, body || {}, adminHeader || "")
        : createOrUpdatePost(body || {}, adminHeader || "");
      if ("error" in result)
        return jsonResponse(result, result.status || 400);

      if (!hasDb) {
        const postsData = listPosts();
        await commitPostsToGitHub(env, postsData).catch(() => {});
      }

      return jsonResponse({ post: result.post }, result.status || 200);
    }

    if (
      request.method === "GET" &&
      path.startsWith("/trade/") &&
      path.endsWith("/messages")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/messages$/, "");
      const data = hasDb
        ? await listTradeMessagesCF(db, tradeId)
        : listTradeMessages(tradeId);
      return jsonResponse(data);
    }

    if (request.method === "GET" && path === "/trades/recent") {
      const since = Number(url.searchParams.get("since") || 0);
      const limit = Number(url.searchParams.get("limit") || 100);
      const data = hasDb
        ? await listRecentTradeMessagesCF(db, { since, limit })
        : listRecentTradeMessages({ since, limit });
      return jsonResponse({ messages: data.messages || [] });
    }

    if (
      request.method === "POST" &&
      path.startsWith("/trade/") &&
      path.endsWith("/message")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/message$/, "");
      const body = await request.json().catch(() => null);
      const msg = body?.message || "";
      const from = body?.from || "unknown";

      let proofMeta: { filename: string; url?: string } | undefined;
      if (body?.proof?.filename && body?.proof?.data) {
        try {
          const sup = await uploadProofToSupabase(env, tradeId, body.proof);
          proofMeta = {
            filename: body.proof.filename,
            url: sup.ok ? sup.url : undefined,
          };
        } catch {
          proofMeta = { filename: body.proof.filename };
        }
      }

      const result = hasDb
        ? await addTradeMessageCF(db, tradeId, msg, from)
        : addTradeMessage(tradeId, msg, from, proofMeta);

      if ("error" in result)
        return jsonResponse(result, result.status || 400);

      if (body?.proof?.filename && body?.proof?.data && hasDb) {
        try {
          await recordProofCF(
            db,
            tradeId,
            body.proof.filename,
            proofMeta?.url,
          );
        } catch {}
      }

      return jsonResponse(
        { message: result.message, proofUrl: proofMeta?.url },
        result.status || 200,
      );
    }

    if (
      request.method === "POST" &&
      path.startsWith("/trade/") &&
      path.endsWith("/proof")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/proof$/, "");
      const body = await request.json().catch(() => null);
      const inMem = uploadProof(tradeId, body?.proof);
      if ("error" in inMem)
        return jsonResponse(inMem, inMem.status || 400);

      let supabaseUrl: string | undefined;
      try {
        const sup = await uploadProofToSupabase(env, tradeId, body?.proof);
        if (sup.ok) supabaseUrl = sup.url;
      } catch {}

      if (hasDb) {
        try {
          await recordProofCF(db, tradeId, body?.proof?.filename, supabaseUrl);
        } catch {}
      }

      return jsonResponse({ ok: true, url: supabaseUrl }, 200);
    }

    return jsonResponse({ error: "not found" }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || String(err) }, 500);
  }
}
