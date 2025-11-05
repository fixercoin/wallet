import React, { useState, useEffect } from "react";

const FIXER_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TV";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC = "https://api.mainnet-beta.solana.com";

export default function Swap() {
  const [provider, setProvider] = useState(null);
  const [jupiter, setJupiter] = useState(null);
  const [tokenList, setTokenList] = useState([]);
  const [walletAddr, setWalletAddr] = useState("");
  const [fromMint, setFromMint] = useState(SOL_MINT);
  const [toMint, setToMint] = useState(FIXER_MINT);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [status, setStatus] = useState("");
  const [initialized, setInitialized] = useState(false);

  const connectWallet = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      throw new Error("Phantom not found. Install Phantom to proceed.");
    }
    const prov = window.solana;
    await prov.connect();
    setProvider(prov);
    setWalletAddr(prov.publicKey.toString());
    return prov;
  };

  const initJupiter = async () => {
    if (initialized) return jupiter;
    setStatus("Initializing route solver (this may take a few seconds)…");
    
    try {
      const { Connection, PublicKey } = await import(
        "https://esm.sh/@solana/web3.js@1.73.0"
      );
      const { Jupiter } = await import(
        "https://esm.sh/@jup-ag/core@4.3.0"
      );

      const connection = new Connection(RPC, "confirmed");
      const jup = await Jupiter.load({
        connection,
        cluster: "mainnet-beta",
        user: provider ?? null,
      });

      const tokens = Object.values(jup.tokens);
      tokens.sort((a, b) => {
        if (a.address === SOL_MINT) return -1;
        if (b.address === SOL_MINT) return 1;
        if (a.address === FIXER_MINT) return -1;
        if (b.address === FIXER_MINT) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      setJupiter(jup);
      setTokenList(tokens);
      setInitialized(true);
      setStatus("");
      return jup;
    } catch (err) {
      setStatus("Error initializing Jupiter: " + (err.message || err));
      throw err;
    }
  };

  useEffect(() => {
    initJupiter().catch((e) => {
      console.warn("Jupiter init warning:", e);
    });
  }, []);

  const humanToRaw = (amountStr, decimals) => {
    const amt = Number(amountStr);
    if (isNaN(amt) || amt <= 0) throw new Error("Invalid amount");
    return BigInt(Math.round(amt * Math.pow(10, decimals)));
  };

  const getQuote = async () => {
    try {
      setStatus("Computing routes…");
      if (!provider) await connectWallet();
      if (!jupiter) await initJupiter();

      if (!fromMint || !toMint) throw new Error("Select tokens");

      const fromMeta = jupiter.tokens[fromMint];
      const toMeta = jupiter.tokens[toMint];
      if (!fromMeta || !toMeta) throw new Error("Token metadata not found");

      const decimalsIn = fromMeta.decimals ?? 6;
      const amountRaw = humanToRaw(amount || "0", decimalsIn);

      const routes = await jupiter.computeRoutes({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amountRaw.toString(),
        slippage: 50,
      });

      if (!routes || !routes.routesInfos || routes.routesInfos.length === 0) {
        setQuote(null);
        setStatus("No route found for this pair/amount.");
        return null;
      }

      const best = routes.routesInfos[0];
      const outAmount = BigInt(best.outAmount) ?? BigInt(0);
      const outHuman =
        Number(outAmount) / Math.pow(10, toMeta.decimals ?? 6);
      
      setQuote({
        routes,
        best,
        outHuman,
        outToken: toMeta.symbol,
        hops: best.marketInfos.length,
      });
      setStatus("");
      return { routes, best };
    } catch (err) {
      setStatus("Error: " + (err.message || err));
      console.error(err);
    }
  };

  const executeSwap = async () => {
    try {
      setStatus("Preparing swap…");
      if (!provider) await connectWallet();
      if (!jupiter) await initJupiter();

      const fromMeta = jupiter.tokens[fromMint];
      const toMeta = jupiter.tokens[toMint];

      const decimalsIn = fromMeta.decimals ?? 6;
      const amountRaw = humanToRaw(amount || "0", decimalsIn);

      const routes = await jupiter.computeRoutes({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amountRaw.toString(),
        slippage: 50,
      });

      if (!routes || !routes.routesInfos || routes.routesInfos.length === 0)
        throw new Error("No route found");

      const routeInfo = routes.routesInfos[0];

      const { execute } = await jupiter.exchange({ routeInfo });

      setStatus("Awaiting wallet signature (Phantom)…");

      if (!jupiter.user) {
        jupiter.setUser(provider);
      }

      const swapResult = await execute();
      setStatus(
        `Swap submitted. Signature: ${swapResult.txSig || swapResult.signature || "see console"}`
      );
      console.log("Swap result:", swapResult);
      return swapResult;
    } catch (err) {
      setStatus("Swap error: " + (err.message || err));
      console.error(err);
    }
  };

  return (
    <div
      style={{
        maxWidth: "520px",
        padding: "12px",
        border: "1px solid #eee",
        borderRadius: "8px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h3 style={{ margin: "0 0 8px 0" }}>Fixorium — Convert (Direct)</h3>

      <div style={{ marginBottom: "8px" }}>
        <button
          onClick={connectWallet}
          style={{ padding: "8px 10px", cursor: "pointer" }}
        >
          Connect Phantom
        </button>
        <span style={{ marginLeft: "10px", color: "#666" }}>
          {walletAddr || "Not connected"}
        </span>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "12px", color: "#333" }}>From</label>
          <br />
          <select
            value={fromMint}
            onChange={(e) => setFromMint(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            {tokenList.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol} ({t.address.slice(0, 6)})
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: "14px", textAlign: "center", color: "#999" }}>
          →
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "12px", color: "#333" }}>To</label>
          <br />
          <select
            value={toMint}
            onChange={(e) => setToMint(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            {tokenList.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol} ({t.address.slice(0, 6)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (in token units, e.g. 0.1)"
          style={{ padding: "8px", width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <button
          onClick={getQuote}
          style={{ padding: "8px 12px", cursor: "pointer" }}
        >
          Get Quote
        </button>
        <button
          onClick={executeSwap}
          style={{ padding: "8px 12px", cursor: "pointer" }}
        >
          Convert (Swap)
        </button>
        <div style={{ marginLeft: "8px", color: "#333" }}>{status}</div>
      </div>

      {quote && (
        <div style={{ marginTop: "6px", color: "#333" }}>
          <strong>Estimated receive:</strong> {quote.outHuman.toFixed(6)}{" "}
          {quote.outToken} (route hops: {quote.hops})
        </div>
      )}
    </div>
  );
}
