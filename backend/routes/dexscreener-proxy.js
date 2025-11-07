const DEXSCREENER_ENDPOINTS = [
  'https://api.dexscreener.com/latest/dex',
  'https://api.dexscreener.io/latest/dex',
];

const CACHE_TTL_MS = 30_000;
const MAX_TOKENS_PER_BATCH = 20;

let currentEndpointIndex = 0;
const cache = new Map();
const inflightRequests = new Map();

async function tryDexscreenerEndpoints(path) {
  let lastError = null;

  for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
    const endpointIndex =
      (currentEndpointIndex + i) % DEXSCREENER_ENDPOINTS.length;
    const endpoint = DEXSCREENER_ENDPOINTS[endpointIndex];
    const url = `${endpoint}${path}`;

    try {
      console.log(`Trying DexScreener API: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SolanaWallet/1.0)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DexScreener API returned ${response.status}`);
      }

      const data = await response.json();
      currentEndpointIndex = endpointIndex;
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`DexScreener endpoint ${i} failed:`, error.message);
      continue;
    }
  }

  throw lastError || new Error('All DexScreener endpoints failed');
}

export async function handleDexscreenerTokens(req, res) {
  try {
    const { tokens } = req.query;
    if (!tokens) {
      return res.status(400).json({
        error: 'Missing tokens parameter (comma-separated)',
      });
    }

    const tokenList = String(tokens)
      .split(',')
      .slice(0, MAX_TOKENS_PER_BATCH);
    const path = `/tokens/${tokenList.join(',')}`;

    const data = await tryDexscreenerEndpoints(path);
    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: 'DexScreener API error',
      details: error.message,
    });
  }
}

export async function handleDexscreenerSearch(req, res) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const path = `/search/?q=${encodeURIComponent(String(q))}`;
    const data = await tryDexscreenerEndpoints(path);
    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: 'DexScreener search failed',
      details: error.message,
    });
  }
}

export async function handleDexscreenerTrending(req, res) {
  try {
    const { chainId = 'solana' } = req.query;
    const path = `/search/?q=&chainId=${chainId}`;
    const data = await tryDexscreenerEndpoints(path);
    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: 'DexScreener trending failed',
      details: error.message,
    });
  }
}
