// Production deployment defaults
const CLOUDFLARE_WORKER_BASE =
  "https://fixorium-proxy.khanbabusargodha.workers.dev";

const normalizeBase = (value: string | null | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const determineBase = (): string => {
  const envBase = normalizeBase(import.meta.env?.VITE_API_BASE_URL);
  if (envBase) return envBase;

  // Development: localhost uses local Express backend
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return "";
  }

  // Production on Netlify: use local /api (proxied to netlify functions)
  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes("netlify.app")
  ) {
    return "";
  }

  // Production on Cloudflare Pages: use Cloudflare Worker
  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes("pages.dev")
  ) {
    return CLOUDFLARE_WORKER_BASE;
  }

  // Custom domain deployment (fixorium.com.pk):
  // - If at wallet.fixorium.com.pk (Cloudflare domain with worker route), use local /api
  // - Otherwise use Cloudflare Worker proxy
  if (
    typeof window !== "undefined" &&
    (window.location.hostname.includes("fixorium.com.pk") ||
      window.location.hostname.includes("fixorium.com"))
  ) {
    // If the app is deployed at wallet.fixorium.com.pk with Cloudflare Worker routing /api/*,
    // use empty base to hit local /api endpoints (which route to the worker)
    if (window.location.hostname === "wallet.fixorium.com.pk") {
      return "";
    }
    // For other fixorium subdomains, use the Cloudflare Worker proxy
    return CLOUDFLARE_WORKER_BASE;
  }

  // Fallback to Cloudflare Worker
  return CLOUDFLARE_WORKER_BASE;
};

let cachedBase: string | null = null;

export const getApiBaseUrl = (): string => {
  if (cachedBase === null) {
    cachedBase = determineBase();
  }
  return cachedBase;
};

export const resolveApiUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (!base) {
    // When no base is configured, ensure /api prefix is present for local routes
    return normalizedPath.startsWith("/api") ? normalizedPath : `/api${normalizedPath}`;
  }
  // When base is set (e.g., https://wallet.fixorium.com.pk/api), don't duplicate /api
  if (normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.substring(4)}`; // Remove /api prefix from path
  }
  return `${base}${normalizedPath}`;
};
