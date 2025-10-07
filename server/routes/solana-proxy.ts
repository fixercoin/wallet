import { RequestHandler } from "express";

// RPC endpoints: if HELIUS_RPC is configured, use it exclusively to avoid unauthenticated providers
const RPC_ENDPOINTS = process.env.HELIUS_RPC
  ? [process.env.HELIUS_RPC, "https://api.mainnet-beta.solana.com"]
  : [
      "https://api.mainnet-beta.solana.com", // Official Solana endpoint
      "https://rpc.ankr.com/solana", // Ankr public RPC
      "https://solana-mainnet.rpc.extrnode.com", // Extrnode public RPC
      "https://solana.blockpi.network/v1/rpc/public", // BlockPI public RPC
      "https://solana.publicnode.com", // Public node
    ];

// Circuit breaker to track failed endpoints
const failedEndpoints = new Map<
  string,
  { count: number; lastFailed: number }
>();
const CIRCUIT_BREAKER_THRESHOLD = 5; // Increased threshold
const CIRCUIT_BREAKER_TIMEOUT = 30000; // Reduced to 30 seconds

const isEndpointCircuitOpen = (endpoint: string): boolean => {
  const failure = failedEndpoints.get(endpoint);
  if (!failure) return false;

  if (failure.count >= CIRCUIT_BREAKER_THRESHOLD) {
    if (Date.now() - failure.lastFailed < CIRCUIT_BREAKER_TIMEOUT) {
      return true; // Circuit is open
    } else {
      // Reset circuit after timeout
      failedEndpoints.delete(endpoint);
      return false;
    }
  }
  return false;
};

const recordEndpointFailure = (endpoint: string) => {
  const failure = failedEndpoints.get(endpoint) || { count: 0, lastFailed: 0 };
  failure.count += 1;
  failure.lastFailed = Date.now();
  failedEndpoints.set(endpoint, failure);
};

const recordEndpointSuccess = (endpoint: string) => {
  failedEndpoints.delete(endpoint); // Clear failures on success
};

let currentEndpointIndex = 0;

const tryRpcEndpoints = async (body: any, maxRetries = 2): Promise<any> => {
  let lastError: Error | null = null;
  let attemptCount = 0;
  const endpointErrors: {
    endpoint: string;
    message: string;
    status?: number;
  }[] = [];

  // If all circuits are open, reset once to force at least one attempt
  const allOpen = RPC_ENDPOINTS.every((e) => isEndpointCircuitOpen(e));
  if (allOpen) {
    console.warn(
      "All RPC circuits open; temporarily resetting circuit breaker to force retry",
    );
    failedEndpoints.clear();
  }

  // Try each endpoint with retry logic
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpointIndex = (currentEndpointIndex + i) % RPC_ENDPOINTS.length;
    const endpoint = RPC_ENDPOINTS[endpointIndex];

    // Skip if circuit breaker is open
    if (isEndpointCircuitOpen(endpoint)) {
      console.log(`Skipping ${endpoint} - circuit breaker open`);
      continue;
    }

    // Use fewer retries for backup endpoints to fail faster
    const endpointRetries = endpoint.includes("api.mainnet-beta.solana.com")
      ? maxRetries
      : 1;

    for (let retry = 0; retry < endpointRetries; retry++) {
      attemptCount++;
      try {
        console.log(
          `Attempting RPC call to ${endpoint} (attempt ${retry + 1}/${maxRetries})`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Read text body (may be empty) for better diagnostics
        const responseText = await response.text().catch(() => "");

        if (!response.ok) {
          const errorText =
            responseText || response.statusText || "(no response body)";

          // Record the endpoint error for final diagnostics
          endpointErrors.push({
            endpoint,
            message: errorText,
            status: response.status,
          });

          if (response.status === 429) {
            console.log(`Rate limited by ${endpoint}, waiting before retry...`);
            if (endpoint.includes("api.mainnet-beta.solana.com")) {
              await new Promise((resolve) =>
                setTimeout(resolve, 5000 * (retry + 1)),
              );
            } else {
              await new Promise((resolve) =>
                setTimeout(resolve, 2000 * (retry + 1)),
              );
            }
            continue;
          }

          if (response.status === 503 || response.status === 502) {
            console.log(`Service unavailable on ${endpoint}, trying next...`);
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (retry + 1)),
            );
            continue;
          }

          if (response.status === 404) {
            console.log(
              `404 from ${endpoint} (likely not a Solana RPC root). Skipping endpoint.`,
            );
            for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++)
              recordEndpointFailure(endpoint);
            break; // move to next endpoint
          }

          if (response.status === 401 || response.status === 403) {
            console.log(
              `Authentication error from ${endpoint}, skipping to next endpoint`,
            );
            endpointErrors.push({
              endpoint,
              message: `Authentication required`,
              status: response.status,
            });
            throw new Error(`Authentication required for ${endpoint}`);
          }

          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Try to parse JSON; if empty, proceed with the raw text
        let data: any = null;
        try {
          data = responseText ? JSON.parse(responseText) : null;
        } catch (e) {
          // Non-JSON response
          data = responseText;
        }

        if (data && typeof data === "object" && data.error) {
          const msg = String(data.error?.message || "");
          const errorMsg = `RPC error: ${msg || "Unknown RPC error"} (code: ${data.error?.code || "unknown"})`;
          console.error(`RPC error from ${endpoint}:`, data.error);
          endpointErrors.push({
            endpoint,
            message: errorMsg,
            status: undefined,
          });

          // If endpoint returns Method not found, attempt common method mappings (compatibility for providers like Helius)
          const methodNotFound = msg.toLowerCase().includes("method not found");
          if (methodNotFound) {
            const methodMap: Record<string, string> = {
              getLatestBlockhash: "getRecentBlockhash",
              // other potential mappings can be added here
            };

            const requestedMethod = body.method as string;
            if (requestedMethod && methodMap[requestedMethod]) {
              const mapped = methodMap[requestedMethod];
              console.log(
                `Provider ${endpoint} reports method not found for ${requestedMethod}, retrying as ${mapped}`,
              );
              // Try single retry with mapped method on same endpoint
              try {
                const retryBody = { ...body, method: mapped };
                const retryResp = await fetch(endpoint, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(retryBody),
                });
                const retryText = await retryResp.text().catch(() => "");
                if (!retryResp.ok) {
                  const errTxt =
                    retryText || retryResp.statusText || `(no response body)`;
                  endpointErrors.push({
                    endpoint,
                    message: `Retry ${mapped} failed: ${errTxt}`,
                  });
                  // mark failure and continue to next endpoint
                } else {
                  let retryData: any = null;
                  try {
                    retryData = retryText ? JSON.parse(retryText) : null;
                  } catch (e) {
                    retryData = retryText;
                  }
                  if (retryData && retryData.error) {
                    endpointErrors.push({
                      endpoint,
                      message: `Retry ${mapped} error: ${retryData.error?.message || JSON.stringify(retryData.error)}`,
                    });
                  } else {
                    currentEndpointIndex = endpointIndex;
                    recordEndpointSuccess(endpoint);
                    console.log(
                      `RPC call successful via ${endpoint} using mapped method ${mapped}`,
                    );
                    return retryData ?? retryText;
                  }
                }
              } catch (retryErr) {
                console.warn(
                  `Retry with mapped method ${mapped} failed:`,
                  retryErr,
                );
                endpointErrors.push({
                  endpoint,
                  message: `Retry ${mapped} exception: ${String(retryErr)}`,
                });
              }

              // If mapped retry didn't return, mark failures for this endpoint
              for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++)
                recordEndpointFailure(endpoint);
            } else {
              // mark endpoint as failed for method not found
              for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++)
                recordEndpointFailure(endpoint);
            }

            // As a final attempt, try the official Solana RPC directly once (bypass provider)
            try {
              console.log(
                `Attempting direct retry to official Solana RPC for method ${body.method}`,
              );
              const officialResp = await fetch(
                "https://api.mainnet-beta.solana.com",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(body),
                },
              );
              const officialText = await officialResp.text().catch(() => "");
              if (!officialResp.ok) {
                console.warn(
                  `Official RPC retry failed: ${officialResp.status} ${officialText}`,
                );
              } else {
                let officialData: any = null;
                try {
                  officialData = officialText ? JSON.parse(officialText) : null;
                } catch (e) {
                  officialData = officialText;
                }
                if (officialData && officialData.error) {
                  console.warn(
                    "Official RPC returned error:",
                    officialData.error,
                  );
                } else {
                  console.log(
                    "Official RPC succeeded for mapped-method fallback",
                  );
                  return officialData ?? officialText;
                }
              }
            } catch (offErr) {
              console.warn("Direct official RPC retry failed:", offErr);
            }
          }

          throw new Error(errorMsg);
        }

        // Success - update the current endpoint and return parsed data or raw text
        currentEndpointIndex = endpointIndex;
        recordEndpointSuccess(endpoint);
        console.log(`RPC call successful via ${endpoint}`);
        return data ?? responseText;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(
          `RPC endpoint ${endpoint} failed (attempt ${retry + 1}):`,
          {
            error: errorMsg,
            method: body.method,
            endpoint: endpoint,
            stack: error instanceof Error ? error.stack : undefined,
          },
        );
        lastError = error instanceof Error ? error : new Error(String(error));
        endpointErrors.push({ endpoint, message: errorMsg });
        recordEndpointFailure(endpoint);

        if (
          errorMsg.includes("API key") ||
          errorMsg.includes("Authentication required") ||
          errorMsg.includes("401") ||
          errorMsg.includes("403")
        ) {
          console.log(
            `Marking ${endpoint} as permanently failed due to auth issues`,
          );
          for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
            recordEndpointFailure(endpoint);
          }
          break; // Skip remaining retries for this endpoint
        }

        if (
          errorMsg.includes("429") ||
          errorMsg.includes("timeout") ||
          errorMsg.includes("aborted")
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, 2000 * (retry + 1)),
          );
        }
      }
    }
  }

  // If we skipped all endpoints (attemptCount === 0), try official once without circuit rules
  if (attemptCount === 0) {
    try {
      console.warn(
        "No RPC attempts made (circuits?). Forcing single attempt to official endpoint.",
      );
      const resp = await fetch(RPC_ENDPOINTS[0], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const respText = await resp.text().catch(() => "");
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${respText || resp.statusText}`);
      }
      const data = respText ? JSON.parse(respText) : null;
      if (data && data.error)
        throw new Error(data.error.message || "RPC error");
      return data ?? respText;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      endpointErrors.push({
        endpoint: RPC_ENDPOINTS[0],
        message: lastError.message,
      });
    }
  }

  // All endpoints failed - provide helpful error message with endpoint diagnostics
  const diagnostic = endpointErrors.map(
    (pe) => `${pe.endpoint}: ${pe.message}`,
  );
  const errorMessage = `All ${RPC_ENDPOINTS.length} RPC endpoints failed after ${attemptCount} attempts. Last error: ${lastError?.message || "Unknown error"}. Endpoint diagnostics: ${diagnostic.join(" | ")}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
};

export const handleSolanaRpc: RequestHandler = async (req, res) => {
  try {
    const { method, params, id } = req.body;

    if (!method) {
      return res.status(400).json({
        error: { code: -32600, message: "Invalid Request - missing method" },
      });
    }

    console.log(
      `Handling RPC request: ${method} with ${params?.length || 0} params`,
      { params: JSON.stringify(params) },
    );

    // Additional logging for transaction submission to help diagnose RPC 500s
    if (method === "sendTransaction" || method === "sendRawTransaction") {
      try {
        const raw = params && params[0] ? String(params[0]) : "";
        console.log(
          `Submitting transaction preview: len=${raw.length}, prefix=${raw.slice(0, 24)}`,
        );
      } catch (e) {
        console.warn("Could not log transaction preview", e);
      }
    }

    // Add small delay for token account requests to avoid rate limiting
    if (method === "getTokenAccountsByOwner") {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const rpcRequest = {
      jsonrpc: "2.0",
      id: id || 1,
      method,
      params: params || [],
    };

    const result = await tryRpcEndpoints(rpcRequest);
    console.log(`RPC request ${method} completed successfully`);
    res.json(result);
  } catch (error) {
    console.error("Solana RPC proxy error:", {
      method: req.body?.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: typeof error,
      errorString: String(error),
      errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });

    res.status(500).json({
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
    });
  }
};
