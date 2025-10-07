// Dynamic wrapper for a hypothetical PumpSwap SDK (e.g., @pump/swap-sdk).
// The wrapper uses dynamic import so the app still runs if the SDK is not installed.

const pumpImportError = new Error(
  "PumpSwap SDK is not installed. To enable PumpSwap swaps run: pnpm add @pump/swap-sdk and restart the dev server."
);

async function ensurePump() {
  try {
    const pkgName = "@pump/swap-sdk";
    // @ts-ignore
    const mod = await import(/* @vite-ignore */ pkgName);
    return mod.default || mod;
  } catch (err) {
    throw pumpImportError;
  }
}

export async function getPoolByMint(connectionUrl: string, mint: string) {
  const pump = await ensurePump();
  const conn = new (await import("@solana/web3.js")).Connection(connectionUrl);
  if (typeof pump.getPoolByMint === "function") {
    return await pump.getPoolByMint(conn, mint);
  }
  if (typeof pump.prototype?.getPoolByMint === "function") {
    const sdk = new pump({ connection: conn });
    return await sdk.getPoolByMint(mint);
  }
  throw new Error("PumpSwap SDK does not expose getPoolByMint in this version");
}

export async function buildSwapInstruction(sdkConfig: { connectionUrl: string; pool: any; owner: string; amountIn: number; side?: string; }) {
  const pump = await ensurePump();
  const conn = new (await import("@solana/web3.js")).Connection(sdkConfig.connectionUrl);
  // If SDK exposes a builder function
  if (typeof pump.buildSwapInstruction === "function") {
    return await pump.buildSwapInstruction({
      connection: conn,
      pool: sdkConfig.pool,
      owner: sdkConfig.owner,
      amountIn: sdkConfig.amountIn,
      side: sdkConfig.side || "BUY",
    });
  }

  // If SDK is a constructor with instance methods
  if (typeof pump === "function") {
    const sdk = new pump({ connection: conn });
    if (typeof sdk.buildSwapInstruction === "function") {
      return await sdk.buildSwapInstruction({ pool: sdkConfig.pool, owner: sdkConfig.owner, amountIn: sdkConfig.amountIn, side: sdkConfig.side || "BUY" });
    }
  }

  throw new Error("PumpSwap SDK does not provide a buildSwapInstruction method in this version");
}
