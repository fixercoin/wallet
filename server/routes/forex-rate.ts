import { RequestHandler } from "express";

export const handleForexRate: RequestHandler = async (req, res) => {
  try {
    const base = String(req.query.base || "USD").toUpperCase();
    const symbols = String(req.query.symbols || "PKR").toUpperCase();
    const firstSymbol = symbols.split(",")[0];
    const PROVIDER_TIMEOUT_MS = 5000;

    const providers: Array<{
      name: string;
      url: string;
      parse: (j: any) => number | null;
    }> = [
      {
        name: "exchangerate.host",
        url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        name: "frankfurter",
        url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        name: "er-api",
        url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        name: "fawazahmed-cdn",
        url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
        parse: (j) =>
          j && typeof j[firstSymbol.toLowerCase()] === "number"
            ? j[firstSymbol.toLowerCase()]
            : null,
      },
    ];

    const fetchProvider = async (
      provider: (typeof providers)[number],
    ): Promise<{ rate: number; provider: string }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        PROVIDER_TIMEOUT_MS,
      );
      try {
        const resp = await fetch(provider.url, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
          signal: controller.signal as any,
        } as any);
        if (!resp.ok) {
          const reason = `${resp.status} ${resp.statusText}`;
          throw new Error(reason.trim() || "non-ok response");
        }
        const json = await resp.json();
        const rate = provider.parse(json);
        if (typeof rate === "number" && isFinite(rate) && rate > 0) {
          return { rate, provider: provider.name };
        }
        throw new Error("invalid response payload");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[${provider.name}] ${message}`);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const runProviders = () => {
      const attempts = providers.map((p) => fetchProvider(p));
      if (typeof (Promise as any).any === "function") {
        return (Promise as any).any(attempts);
      }
      return new Promise<{ rate: number; provider: string }>(
        (resolve, reject) => {
          const errors: string[] = [];
          let remaining = attempts.length;
          attempts.forEach((attempt) => {
            attempt.then(resolve).catch((err) => {
              errors.push(err instanceof Error ? err.message : String(err));
              remaining -= 1;
              if (remaining === 0) reject(new Error(errors.join("; ")));
            });
          });
        },
      );
    };

    try {
      const { rate, provider } = await runProviders();
      res.json({
        base,
        symbols: [firstSymbol],
        rates: { [firstSymbol]: rate },
        provider,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res
        .status(502)
        .json({ error: "Failed to fetch forex rate", details: msg });
    }
  } catch (error) {
    res.status(500).json({ error: "Unexpected error" });
  }
};
