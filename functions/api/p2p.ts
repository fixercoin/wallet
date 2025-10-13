import {
  listPosts,
  getPost,
  createOrUpdatePost,
  listTradeMessages,
  addTradeMessage,
  uploadProof,
} from "../../utils/p2pStore";

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
    // Expect base64 without data URL prefix
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

async function commitPostsToGitHub(env: Record<string, string | undefined> | undefined, postsData: any) {
  try {
    const token = env?.GITHUB_TOKEN || env?.GITHUB_PAT || env?.GITHUB_TOKEN_SECRET;
    const repo = env?.GITHUB_REPO || "fixercoin/wallet"; // owner/repo
    const branch = env?.GITHUB_BRANCH || "zen-works";
    if (!token) return { ok: false, error: "no_github_token" } as const;
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) return { ok: false, error: "invalid_repo" } as const;
    const filePath = "data/p2p-store.json";
    const content = JSON.stringify(postsData, null, 2);
    const base64Content = Buffer.from(content).toString("base64");

    const getUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`;
    const commonHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    } as Record<string, string>;

    let sha: string | undefined = undefined;
    try {
      const getResp = await fetch(getUrl, { headers: commonHeaders });
      if (getResp.ok) {
        const data = await getResp.json().catch(() => null);
        if (data && data.sha) sha = data.sha;
      }
    } catch (e) {
      // ignore - we'll try to create
    }

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
        ...commonHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!putResp.ok) {
      const txt = await putResp.text().catch(() => "");
      return { ok: false, error: `github_put_failed ${putResp.status} ${txt}` } as const;
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
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,X-Admin-Wallet",
      },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/api\/p2p/, "");

  try {
    if (request.method === "GET" && (path === "/list" || path === "/")) {
      return jsonResponse(listPosts());
    }

    // Export posts as downloadable JSON
    if (request.method === "GET" && path === "/export") {
      const data = listPosts();
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
      const post = getPost(id);
      if (!post) return jsonResponse({ error: "not found" }, 404);
      return jsonResponse({ post });
    }

    if (
      (request.method === "POST" || request.method === "PUT") &&
      path === "/post"
    ) {
      const body = await request.json().catch(() => null);
      const adminHeader =
        request.headers.get("x-admin-wallet") || body?.adminWallet || "";
      const result = createOrUpdatePost(body || {}, adminHeader || "");
      if ("error" in result)
        return jsonResponse({ error: result.error }, result.status);
      return jsonResponse({ post: result.post }, result.status);
    }

    if (
      request.method === "GET" &&
      path.startsWith("/trade/") &&
      path.endsWith("/messages")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/messages$/, "");
      return jsonResponse(listTradeMessages(tradeId));
    }

    if (
      request.method === "POST" &&
      path.startsWith("/trade/") &&
      path.endsWith("/message")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/message$/, "");
      const body = await request.json().catch(() => null);
      const msg = (body && body.message) || "";
      const from = (body && body.from) || "unknown";
      const result = addTradeMessage(tradeId, msg, from);
      if ("error" in result)
        return jsonResponse({ error: result.error }, result.status);
      return jsonResponse({ message: result.message }, result.status);
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
        return jsonResponse({ error: inMem.error }, inMem.status);

      let supabaseUrl: string | undefined;
      try {
        const sup = await uploadProofToSupabase(env, tradeId, body?.proof);
        if (sup.ok) supabaseUrl = (sup as any).url as string;
      } catch {}

      return jsonResponse({ ok: true, url: supabaseUrl }, inMem.status);
    }

    return jsonResponse({ error: "not found" }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || String(err) }, 500);
  }
}
