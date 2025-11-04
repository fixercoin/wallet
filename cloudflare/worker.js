// Compiled worker (JS) generated from cloudflare/src/worker.ts
// NOTE: This is a standalone JS worker you can paste into the Cloudflare Worker editor.

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function parseJSON(req) {
  const text = await req.text();
  try { return JSON.parse(text); } catch { return null; }
}

const DEFAULT_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.rpc.extrnode.com',
  'https://solana.blockpi.network/v1/rpc/public',
  'https://solana.publicnode.com',
];

function getRpcEndpoints(env) {
  const list = [
    (env && env.SOLANA_RPC) || '',
    (env && env.HELIUS_RPC_URL) || '',
    (env && env.ALCHEMY_RPC_URL) || '',
    (env && env.MORALIS_RPC_URL) || '',
    ...DEFAULT_RPCS,
  ];
  return list.filter(Boolean);
}

async function callRpc(env, method, params = [], id = Date.now()) {
  let lastError = null;
  const payload = { jsonrpc: '2.0', id, method, params };
  const endpoints = getRpcEndpoints(env);
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        if ([429,502,503].includes(resp.status)) continue;
        const t = await resp.text().catch(()=>"");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }
      const data = await resp.text();
      return { ok: true, body: data };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(lastError && lastError.message ? lastError.message : 'All RPC endpoints failed');
}

async function tryFetch(target, method='GET', body, timeoutMs=10000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(target, {
      method,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    return null;
  }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    const corsHeaders = {
      'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // Health
    if (pathname === '/' || pathname === '/api/health' || pathname === '/api/ping') {
      return json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders });
    }

    // /api/swap/quote
    if (pathname === '/api/swap/quote' && req.method === 'GET') {
      const mint = searchParams.get('mint') || '';
      const inputMint = searchParams.get('inputMint') || '';
      const outputMint = searchParams.get('outputMint') || '';
      const amount = searchParams.get('amount') || '';
      try {
        if (mint) {
          const pump = await tryFetch(`https://pumpportal.fun/api/quote?mint=${encodeURIComponent(mint)}`);
          if (pump) return json(pump, { headers: corsHeaders });
        }
        if (inputMint && outputMint && amount) {
          const meteoraUrl = `https://api.meteora.ag/swap/v3/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const met = await tryFetch(meteoraUrl, 'GET', undefined, 12000);
          if (met) return json({ source: 'meteora', quote: met }, { headers: corsHeaders });
          const jupiterUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const jup = await tryFetch(jupiterUrl, 'GET', undefined, 10000);
          if (jup) return json({ source: 'jupiter', quote: jup }, { headers: corsHeaders });
        }
        if (inputMint && outputMint && amount) {
          const rayUrl = `https://api.raydium.io/swap/quote`;
          const ray = await tryFetch(rayUrl, 'POST', { inputMint, outputMint, amount }, 8000);
          if (ray) return json({ source: 'raydium', quote: ray }, { headers: corsHeaders });
          const orcaUrl = `https://api.orca.so/pools/price`;
          const orca = await tryFetch(orcaUrl, 'POST', { inputMint, outputMint, amount }, 8000);
          if (orca) return json({ source: 'orca', quote: orca }, { headers: corsHeaders });
        }
        return json({ error: 'no_quote_available' }, { status: 502, headers: corsHeaders });
      } catch (e) {
        return json({ error: 'Failed to fetch swap quote', details: e && e.message ? e.message : String(e) }, { status: 502, headers: corsHeaders });
      }
    }

    // /api/swap (unified execution builder) - proxy to Meteora/Jupiter/Pumpfun
    if (pathname === '/api/swap' && req.method === 'POST') {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== 'object') return json({ error: 'Invalid request body', message: 'POST body must be valid JSON' }, { status: 400, headers: corsHeaders });
        const provider = (body.provider || 'auto').toLowerCase();
        const inputMint = body.inputMint;
        const outputMint = body.outputMint;
        const amount = body.amount;
        const mint = body.mint;
        const wallet = body.wallet;
        const routePlan = body.routePlan;

        // Meteora
        if ((provider === 'meteora' || provider === 'auto') && inputMint && outputMint && amount) {
          try {
            const meteoraPayload = {
              userPublicKey: wallet,
              inputMint,
              outputMint,
              inputAmount: String(amount),
              slippageBps: body.slippageBps || 500,
              sign: !!body.sign === true,
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const resp = await fetch('https://api.meteora.ag/swap/v3/swap', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(meteoraPayload), signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (resp.ok) {
              const data = await resp.json();
              return json({ source: 'meteora', swap: data, signingRequired: true, hint: 'Sign on client' }, { headers: corsHeaders });
            } else {
              if (provider === 'meteora') {
                const errorText = await resp.text().catch(()=>"");
                return json({ error: `Meteora swap failed with status ${resp.status}`, details: errorText }, { status: resp.status, headers: corsHeaders });
              }
            }
          } catch (e) {
            if (provider === 'meteora') return json({ error: 'Meteora swap failed', details: e && e.message ? e.message : String(e) }, { status: 502, headers: corsHeaders });
          }
        }

        // Jupiter (requires routePlan)
        if ((provider === 'jupiter' || provider === 'auto') && inputMint && routePlan) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const resp = await fetch('https://quote-api.jup.ag/v6/swap', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body), signal: controller.signal });
            clearTimeout(timeoutId);
            if (resp.ok) { const data = await resp.json(); return json({ source: 'jupiter', swap: data }, { headers: corsHeaders }); }
          } catch (e) {
            if (provider === 'jupiter') return json({ error: 'Jupiter swap failed', details: e && e.message ? e.message : String(e) }, { status: 502, headers: corsHeaders });
          }
        }

        // Pumpfun
        if ((provider === 'pumpfun' || provider === 'auto') && mint && amount) {
          try {
            const swapPayload = { mint, amount: String(amount), decimals: body.decimals || 6, slippage: body.slippage || 10, txVersion: body.txVersion || 'V0', priorityFee: body.priorityFee || 0.0005, wallet };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const resp = await fetch('https://pumpportal.fun/api/trade', { method: 'POST', headers: {'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(swapPayload), signal: controller.signal });
            clearTimeout(timeoutId);
            if (resp.ok) { const data = await resp.json(); return json({ source: 'pumpfun', swap: data }, { headers: corsHeaders }); } else {
              if (provider === 'pumpfun') { const errorText = await resp.text().catch(()=>""); return json({ error: `Pump.fun swap failed ${resp.status}`, details: errorText }, { status: resp.status, headers: corsHeaders }); }
            }
          } catch (e) { if (provider === 'pumpfun') return json({ error: 'Pumpfun swap failed', details: e && e.message ? e.message : String(e) }, { status: 502, headers: corsHeaders }); }
        }

        // If we reach here, missing params
        let helpText = 'Missing required fields for swap. ';
        if (inputMint && outputMint) helpText += 'For Meteora swaps, provide inputMint, outputMint, amount, wallet.';
        if (inputMint) helpText += ' For Jupiter, also provide routePlan from quote.';
        if (mint) helpText += ' For Pumpfun, provide mint and amount.';
        return json({ error: 'Unable to execute swap - missing required fields', message: helpText }, { status: 400, headers: corsHeaders });
      } catch (e) {
        return json({ error: 'Failed to execute swap', details: e && e.message ? e.message : String(e) }, { status: 502, headers: corsHeaders });
      }
    }

    // /api/swap/build - forwards to /api/swap with sign=false and returns swapTransaction
    if (pathname === '/api/swap/build' && req.method === 'POST') {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== 'object') return json({ error: 'Invalid request body' }, { status: 400, headers: corsHeaders });
        const forwardPayload = { ...body, sign: false };
        const forwardUrl = new URL(req.url);
        forwardUrl.pathname = '/api/swap';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch(forwardUrl.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(forwardPayload), signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await resp.json().catch(()=>null);
        if (!resp.ok) return json({ error: `Build proxy returned ${resp.status}`, details: data }, { status: resp.status, headers: corsHeaders });
        const swapTx = (data && (data.swap && data.swap.swapTransaction)) || data && (data.swapTransaction || data.swapTransactionBase64);
        if (swapTx) return json({ swapTransaction: swapTx, signed: false, source: data && (data._source || data.source) || null }, { headers: corsHeaders });
        return json({ error: 'Unable to build swap transaction', details: data }, { status: 502, headers: corsHeaders });
      } catch (e) {
        return json({ error: 'Failed to build swap transaction', details: e && e.message ? e.message : String(e) }, { status: 502, headers: corsHeaders });
      }
    }

    // /api/swap/submit - accepts signed base64 tx and forwards to RPC (sendTransaction)
    if (pathname === '/api/swap/submit' && req.method === 'POST') {
      try {
        const body = await parseJSON(req);
        const signedTx = (body && (body.signedTx || body.tx || body.signedTransaction));
        if (!signedTx) return json({ error: "Missing 'signedTx' field (base64 transaction)" }, { status: 400, headers: corsHeaders });
        try {
          const rpcResult = await callRpc(env, 'sendTransaction', [signedTx]);
          const parsed = JSON.parse(String(rpcResult && rpcResult.body || '{}'));
          return json({ ok: true, result: parsed }, { headers: corsHeaders });
        } catch (rpcErr) {
          return json({ error: 'Failed to submit signed transaction to RPC', details: rpcErr && rpcErr.message ? rpcErr.message : String(rpcErr) }, { status: 502, headers: corsHeaders });
        }
      } catch (e) {
        return json({ error: 'Invalid request body', details: e && e.message ? e.message : String(e) }, { status: 400, headers: corsHeaders });
      }
    }

    // Fallback 404
    return json({ error: 'API endpoint not found', path: pathname }, { status: 404, headers: corsHeaders });
  }
};
