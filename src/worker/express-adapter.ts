import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  RequestHandler,
} from "express";

type HeadersInitRecord = Record<string, string>;

type NextFunction = (err?: unknown) => void;

type ParsedQuery = Record<string, string | string[]>;

type WorkerHandler = (
  request: Request,
  env: Record<string, unknown>,
  ctx: ExecutionContext,
) => Promise<Response>;

const JSON_CONTENT_TYPE = "application/json";

function normalizeQuery(url: URL): ParsedQuery {
  const query: ParsedQuery = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  return query;
}

async function parseBody(request: Request): Promise<unknown> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const entries = Array.from(formData.entries()).map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ]);
      return Object.fromEntries(entries);
    }

    if (contentType.startsWith("text/")) {
      return await request.text();
    }

    if (contentType.includes("multipart/form-data")) {
      return await request.formData();
    }
  } catch (error) {
    console.warn("Failed to parse request body", error);
    return undefined;
  }

  try {
    return await request.text();
  } catch (error) {
    console.warn("Failed to read request body as text", error);
    return undefined;
  }
}

function createRequestShim(
  request: Request,
  parsedUrl: URL,
  body: unknown,
): Partial<ExpressRequest> {
  const headers = new Headers(request.headers);

  return {
    method: request.method,
    url: request.url,
    originalUrl: parsedUrl.pathname + parsedUrl.search,
    path: parsedUrl.pathname,
    query: normalizeQuery(parsedUrl) as any,
    body,
    headers: Object.fromEntries(headers.entries()) as HeadersInitRecord,
    get(name: string) {
      return headers.get(name.toLowerCase()) ?? undefined;
    },
  } as Partial<ExpressRequest>;
}

interface ResponseCapture {
  status: number;
  headers: Headers;
  body: BodyInit | null;
  ended: boolean;
}

function createResponseShim(): {
  capture: ResponseCapture;
  response: Partial<ExpressResponse>;
} {
  const capture: ResponseCapture = {
    status: 200,
    headers: new Headers(),
    body: null,
    ended: false,
  };

  const ensureContentType = (value: string) => {
    if (!capture.headers.has("content-type")) {
      capture.headers.set("content-type", value);
    }
  };

  const sendBody = (value: unknown) => {
    if (capture.ended) return;

    if (value instanceof Response) {
      capture.status = value.status;
      capture.body = value.body;
      value.headers.forEach((headerValue, headerKey) => {
        capture.headers.set(headerKey, headerValue);
      });
      capture.ended = true;
      return;
    }

    if (value === undefined || value === null) {
      capture.body = null;
      capture.ended = true;
      return;
    }

    if (
      typeof value === "object" &&
      !(value instanceof ArrayBuffer) &&
      !(value instanceof Uint8Array) &&
      !(value instanceof ReadableStream)
    ) {
      ensureContentType(JSON_CONTENT_TYPE);
      capture.body = JSON.stringify(value);
      capture.ended = true;
      return;
    }

    capture.body = value as BodyInit;
    capture.ended = true;
  };

  const response: Partial<ExpressResponse> = {
    status(code: number) {
      capture.status = code;
      return this as ExpressResponse;
    },
    set(field: string, value: string) {
      capture.headers.set(field, value);
      return this as ExpressResponse;
    },
    header(field: string, value: string) {
      capture.headers.set(field, value);
      return this as ExpressResponse;
    },
    json(data: unknown) {
      ensureContentType(JSON_CONTENT_TYPE);
      sendBody(data);
      return this as ExpressResponse;
    },
    send(data?: unknown) {
      sendBody(data);
      return this as ExpressResponse;
    },
    end(data?: unknown) {
      sendBody(data);
      return this as ExpressResponse;
    },
  } as Partial<ExpressResponse>;

  return { capture, response };
}

export function createWorkerHandler(
  handler: RequestHandler,
  options?: {
    enableCors?: boolean;
    corsOrigin?: string;
    corsMethods?: string;
    corsHeaders?: string;
  },
): WorkerHandler {
  const {
    enableCors = true,
    corsOrigin = "*",
    corsMethods = "GET,POST,PUT,DELETE,OPTIONS",
    corsHeaders = "Content-Type,Authorization,X-Requested-With",
  } = options || {};

  return async (request, env, ctx) => {
    const url = new URL(request.url);
    const body = await parseBody(request);
    const reqShim = createRequestShim(request, url, body);
    const { capture, response } = createResponseShim();

    const processShim = (globalThis as any).process as
      | { env?: Record<string, unknown>; uptime?: () => number }
      | undefined;
    if (processShim) {
      processShim.env = env;
    }

    const next: NextFunction = (err?: unknown) => {
      if (err) {
        throw err;
      }
    };

    try {
      await handler(
        reqShim as ExpressRequest,
        response as ExpressResponse,
        next,
      );
    } catch (error) {
      console.error("Worker handler error", error);
      capture.status = 500;
      capture.body = JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
      capture.headers.set("content-type", JSON_CONTENT_TYPE);
    }

    if (enableCors) {
      capture.headers.set("Access-Control-Allow-Origin", corsOrigin);
      capture.headers.set("Access-Control-Allow-Methods", corsMethods);
      capture.headers.set("Access-Control-Allow-Headers", corsHeaders);
      capture.headers.set("Vary", "Origin");
    }

    return new Response(capture.body, {
      status: capture.status,
      headers: capture.headers,
    });
  };
}

export function createOptionsHandler(options?: {
  corsOrigin?: string;
  corsMethods?: string;
  corsHeaders?: string;
}): WorkerHandler {
  const {
    corsOrigin = "*",
    corsMethods = "GET,POST,PUT,DELETE,OPTIONS",
    corsHeaders = "Content-Type,Authorization,X-Requested-With",
  } = options || {};

  return async () =>
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": corsMethods,
        "Access-Control-Allow-Headers": corsHeaders,
        Vary: "Origin",
      },
    });
}
