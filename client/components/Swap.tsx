import React, { useState, useEffect } from "react";
import { useWallet } from "../contexts/WalletContext";
import { jupiterAPI } from "../lib/services/jupiter";

const FIXER_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function Swap() {
  const { wallet } = useWallet();
  const [tokenList, setTokenList] = useState([]);
  const [fromMint, setFromMint] = useState(SOL_MINT);
  const [toMint, setToMint] = useState(FIXER_MINT);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [status, setStatus] = useState("");
  const [initialized, setInitialized] = useState(false);

  const loadTokens = async () => {
    if (initialized) return;

    setStatus("Loading tokens...");

    try {
      const tokens = await jupiterAPI.getStrictTokenList();
      tokens.sort((a, b) => {
        if (a.address === SOL_MINT) return -1;
        if (b.address === SOL_MINT) return 1;
        if (a.address === FIXER_MINT) return -1;
        if (b.address === FIXER_MINT) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      setTokenList(tokens);
      setInitialized(true);
      setStatus("");
    } catch (err) {
      setStatus("Error loading tokens: " + (err.message || err));
      console.error(err);
      setInitialized(true);
    }
  };

  useEffect(() => {
    setInitialized(false);
    loadTokens().catch((e) => {
      console.warn("Token load warning:", e);
    });
  }, [wallet]);

  const humanToRaw = (amountStr, decimals) => {
    const amt = Number(amountStr);
    if (isNaN(amt) || amt <= 0) throw new Error("Invalid amount");
    return BigInt(Math.round(amt * Math.pow(10, decimals)));
  };

  const getQuote = async () => {
    try {
      setStatus("Computing routes…");

      if (!wallet) {
        setStatus("No wallet detected. Please set up a wallet first.");
        return null;
      }

      if (!fromMint || !toMint) throw new Error("Select tokens");

      const fromToken = tokenList.find((t) => t.address === fromMint);
      const toToken = tokenList.find((t) => t.address === toMint);
      if (!fromToken || !toToken) throw new Error("Token metadata not found");

      const decimalsIn = fromToken.decimals ?? 6;
      const amountRaw = humanToRaw(amount || "0", decimalsIn);
      const amountStr = jupiterAPI.formatSwapAmount(
        Number(amountRaw) / Math.pow(10, decimalsIn),
        decimalsIn,
      );

      const quoteResponse = await jupiterAPI.getQuote(
        fromMint,
        toMint,
        parseInt(amountStr),
        5000,
      );

      if (!quoteResponse) {
        setQuote(null);
        setStatus("No route found for this pair/amount.");
        return null;
      }

      // Validate quote response has required fields
      if (!quoteResponse.outAmount) {
        setQuote(null);
        setStatus("Invalid quote response. Please try again.");
        console.error("[Swap] Quote missing outAmount:", quoteResponse);
        return null;
      }

      try {
        const outAmount = BigInt(quoteResponse.outAmount);
        const outHuman =
          Number(outAmount) / Math.pow(10, toToken.decimals ?? 6);

        setQuote({
          quoteResponse,
          outHuman,
          outToken: toToken.symbol,
          hops: quoteResponse.routePlan?.length ?? 0,
        });
        setStatus("");
        return { quoteResponse };
      } catch (bigintErr) {
        setQuote(null);
        setStatus("Invalid quote amount format. Please try again.");
        console.error(
          "[Swap] BigInt conversion error:",
          bigintErr,
          quoteResponse,
        );
        return null;
      }
    } catch (err) {
      setStatus("Error: " + (err.message || err));
      console.error(err);
    }
  };

  const executeSwap = async () => {
    try {
      setStatus("Preparing swap…");

      if (!wallet) {
        setStatus("No wallet detected. Please set up a wallet first.");
        return null;
      }

      if (!quote) {
        setStatus("Get a quote first");
        return null;
      }

      const oldQuote = quote.quoteResponse;

      // Refresh the quote immediately before swap to prevent STALE_QUOTE errors
      setStatus("Refreshing quote…");
      const freshQuote = await jupiterAPI.getQuote(
        oldQuote.inputMint,
        oldQuote.outputMint,
        parseInt(oldQuote.inAmount),
        oldQuote.slippageBps || 5000,
      );

      if (!freshQuote) {
        setStatus(
          "Failed to refresh quote. Using cached quote, but swap may fail.",
        );
        console.warn("Quote refresh failed, using stale quote");
      }

      const swapRequest = {
        quoteResponse: freshQuote || oldQuote,
        userPublicKey: wallet.publicKey,
        wrapAndUnwrapSol: true,
      };

      setStatus("Executing swap…");
      const swapResult = await jupiterAPI.getSwapTransaction(swapRequest);

      if (!swapResult || !swapResult.swapTransaction) {
        throw new Error("Swap transaction generation failed");
      }

      setStatus("Swap transaction prepared. Check your wallet for signing.");
      console.log("Swap result:", swapResult);
      return swapResult;
    } catch (err) {
      setStatus("Swap error: " + (err.message || err));
      console.error(err);
    }
  };

  if (!wallet) {
    return (
      <div
        style={{
          maxWidth: "520px",
          padding: "12px",
          border: "1px solid #eee",
          borderRadius: "8px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
          color: "#666",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0" }}>Fixorium — Convert (Direct)</h3>
        <p>
          No wallet detected. Please set up or import a wallet to use the swap
          feature.
        </p>
      </div>
    );
  }

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
        <span style={{ fontSize: "12px", color: "#999" }}>Wallet:</span>
        <div
          style={{ fontSize: "12px", color: "#333", wordBreak: "break-all" }}
        >
          {wallet.publicKey}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
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

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
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
