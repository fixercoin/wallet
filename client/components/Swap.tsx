"use client";

import React, { useEffect, useState } from "react";
import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { jupiterAPI } from "@/lib/services/jupiter";
import { resolveApiUrl } from "@/lib/api-client";
import { useWallet } from "@/contexts/WalletContext";

export default function Swap() {
  const { toast } = useToast();
  const { wallet, tokens } = useWallet() as any;

  const [fromToken, setFromToken] = useState<any | null>(null);
  const [toToken, setToToken] = useState<any | null>(null);
  const [fromAmount, setFromAmount] = useState<string>("0");
  const [toAmount, setToAmount] = useState<string>("0");
  const [slippage, setSlippage] = useState<number>(1); // percent
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [quote, setQuote] = useState<any | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "success" | "error">("form");

  const { connection } = useWallet() as any; // prefer app-provided connection (avoids exposing server-only RPC keys in browser)
  // Fallback to a client-side connection without HELIUS_RPC
  // if connection is not available, create a public RPC connection
  const fallbackConnection =
    connection && typeof connection.sendRawTransaction === "function"
      ? connection
      : new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const rpcConnection = fallbackConnection;

  // helpers
  function bytesFromBase64(b64: string): Uint8Array {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      return new Uint8Array();
    }
  }

  function coerceSecretKey(val: unknown): Uint8Array | null {
    try {
      if (!val) return null;
      if (val instanceof Uint8Array) return val;
      if (Array.isArray(val)) return Uint8Array.from(val as number[]);
      if (typeof val === "string") {
        // try JSON array
        try {
          const arr = JSON.parse(val);
          if (Array.isArray(arr)) return Uint8Array.from(arr as number[]);
        } catch {}
        // try base64
        try {
          const bin = atob(val);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          if (out.length > 0) return out;
        } catch {}
        try {
          // try base58 decode via window (if bs58 lib missing)
          const bs58 = (window as any).bs58;
          if (bs58 && typeof bs58.decode === "function") {
            const dec = bs58.decode(val);
            if (dec && dec.length >= 32) return dec;
          }
        } catch {}
      }
      if (typeof val === "object") {
        const values = Object.values(val as Record<string, unknown>).filter(
          (x) => typeof x === "number",
        ) as number[];
        if (values.length > 0) return Uint8Array.from(values);
      }
    } catch {}
    return null;
  }

  function getKeypair(): Keypair | null {
    try {
      if (
        wallet &&
        wallet.secretKey !== undefined &&
        wallet.secretKey !== null
      ) {
        const sk = coerceSecretKey(wallet.secretKey);
        if (!sk) return null;
        return Keypair.fromSecretKey(sk);
      }

      // fallback: try to coerce from wallet
      const sk = coerceSecretKey(wallet?.secretKey);
      if (!sk) return null;
      return Keypair.fromSecretKey(sk);
    } catch (e) {
      console.error("getKeypair error:", e);
      return null;
    }
  }

  // Fetch quote whenever inputs change
  useEffect(() => {
    const fetchQuote = async () => {
      if (!fromToken || !toToken || !fromAmount || Number(fromAmount) <= 0) {
        setQuote(null);
        setToAmount("0");
        return;
      }
      try {
        const amountRaw = Math.floor(
          Number(fromAmount) * Math.pow(10, fromToken.decimals),
        );
        const slippageBps = Math.floor(slippage * 100);
        const quoteResp = await jupiterAPI.getQuote(
          fromToken.address,
          toToken.address,
          amountRaw,
          slippageBps,
        );
        if (quoteResp) {
          setQuote(quoteResp);
          // quoteResp.outAmount is a string of units
          const outAmt = quoteResp.outAmount ? Number(quoteResp.outAmount) : 0;
          setToAmount((outAmt / Math.pow(10, toToken.decimals)).toString());
        } else {
          setQuote(null);
          setToAmount("0");
        }
      } catch (err) {
        console.error("Quote error:", err);
        setQuote(null);
        setToAmount("0");
      }
    };
    fetchQuote();
  }, [fromToken, toToken, fromAmount, slippage]);

  // Execute swap
  const executeSwap = async () => {
    if (!quote) return;
    setIsLoading(true);
    try {
      const kp = getKeypair();
      if (!kp) throw new Error("Local wallet not found");

      // Build Jupiter swap request: ensure quote and keypair exist
      if (!quote) throw new Error("Swap quote missing");
      const swapRequest = {
        quoteResponse: quote,
        userPublicKey: kp.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      } as any;
      console.debug("Sending swap request to Jupiter proxy:", swapRequest);
      const swapResponse = await jupiterAPI.getSwapTransaction(swapRequest);

      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error("Failed to get swap transaction from Jupiter");
      }

      // Deserialize transaction
      const raw = bytesFromBase64(swapResponse.swapTransaction);
      let vtx = VersionedTransaction.deserialize(raw);

      // Sign transaction with app's local keypair only. Do NOT use injected wallets.
      // We already ensured kp exists above; sign with it.
      vtx.sign([kp]);

      // Send via server endpoints to avoid exposing RPC keys to browser and avoid forbidden responses
      const serialized = vtx.serialize();
      const signedBase64 = (() => {
        let bin = "";
        for (let i = 0; i < serialized.length; i++)
          bin += String.fromCharCode(serialized[i]);
        try {
          return btoa(bin);
        } catch {
          return Buffer.from(serialized).toString("base64");
        }
      })();

      // Simulate server-side
      const simResp = await fetch(resolveApiUrl("/api/solana-simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedBase64 }),
      });
      if (!simResp.ok) {
        const txt = await simResp.text().catch(() => "");
        throw new Error(`Simulation failed: ${simResp.status} : ${txt}`);
      }
      const simJson = await simResp.json();
      if (simJson?.insufficientLamports) {
        const d = simJson.insufficientLamports;
        const missingSOL = d.diffSol ?? (d.diff ? d.diff / 1e9 : null);
        throw new Error(
          `Insufficient SOL: need ~${missingSOL?.toFixed(6) ?? "0.000000"} SOL`,
        );
      }

      // Send via server
      const sendResp = await fetch(resolveApiUrl("/api/solana-send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedBase64 }),
      });
      if (!sendResp.ok) {
        const txt = await sendResp.text().catch(() => "");
        let parsed = null;
        try {
          parsed = txt ? JSON.parse(txt) : null;
        } catch {}
        const errMsg = parsed?.error?.message || txt || sendResp.statusText;
        throw new Error(`Send failed: ${sendResp.status} : ${errMsg}`);
      }
      const jb = await sendResp.json();
      if (jb.error)
        throw new Error(jb.error.message || JSON.stringify(jb.error));
      const sig = jb.result as string;

      setTxSignature(sig);
      setStep("success");

      toast({
        title: "Swap Completed!",
        description: `Swapped ${fromAmount} ${fromToken?.symbol} for ${toAmount} ${toToken?.symbol}`,
      });
    } catch (error: any) {
      console.error("Swap execution error:", error);
      setStep("error");
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Simple token lists from wallet context for selectors
  const tokenOptions = tokens || [];

  return (
    <div className="max-w-md mx-auto p-4 rounded-2xl shadow bg-white">
      {step === "form" && (
        <>
          <label className="block font-medium">From</label>
          <select
            className="w-full border p-2 mt-2"
            value={fromToken?.address || ""}
            onChange={(e) => {
              const sel = tokenOptions.find(
                (t: any) =>
                  t.mint === e.target.value || t.address === e.target.value,
              );
              setFromToken(sel || null);
            }}
          >
            <option value="">Select token</option>
            {tokenOptions.map((t: any) => (
              <option key={t.mint || t.address} value={t.mint || t.address}>
                {t.symbol} - {t.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            className="w-full border p-2 mt-2"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
          />

          <label className="block font-medium mt-3">To</label>
          <select
            className="w-full border p-2 mt-2"
            value={toToken?.address || ""}
            onChange={(e) => {
              const sel = tokenOptions.find(
                (t: any) =>
                  t.mint === e.target.value || t.address === e.target.value,
              );
              setToToken(sel || null);
            }}
          >
            <option value="">Select token</option>
            {tokenOptions.map((t: any) => (
              <option key={t.mint || t.address} value={t.mint || t.address}>
                {t.symbol} - {t.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="w-full border p-2 mt-2"
            value={toAmount}
            disabled
          />

          <label className="block font-medium mt-3">Slippage %</label>
          <input
            type="number"
            className="w-full border p-2 mt-2"
            value={String(slippage)}
            onChange={(e) => setSlippage(Number(e.target.value))}
          />

          <button
            className="w-full mt-4 p-3 bg-blue-600 text-white rounded-xl"
            disabled={isLoading || !quote}
            onClick={executeSwap}
          >
            {isLoading ? "Swapping..." : "Swap"}
          </button>
        </>
      )}

      {step === "success" && (
        <div className="text-center p-4">
          <h2 className="text-xl font-bold">Swap Successful ✅</h2>
          <p className="mt-2">Signature: {txSignature}</p>
        </div>
      )}

      {step === "error" && (
        <div className="text-center p-4 text-red-600">
          <h2 className="text-xl font-bold">Swap Failed ❌</h2>
        </div>
      )}
    </div>
  );
}
