import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { jupiterV6API } from "./services/jupiter-v6";
import { botOrdersStorage, BotOrder, BotSession } from "./bot-orders-storage";
import { bytesFromBase64, base64FromBytes } from "./bytes";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWaLb3odccVLd7wfL9K3JWuWKq6PPczQkfCW2eKi";
const FIXERCOIN_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";

interface ExecutionResult {
  success: boolean;
  signature?: string;
  error?: string;
  order?: BotOrder;
}

async function sendSignedTx(
  txBase64: string,
  keypair: Keypair,
): Promise<string> {
  try {
    const buf = bytesFromBase64(txBase64);
    const vtx = VersionedTransaction.deserialize(buf);
    vtx.sign([keypair]);
    const signed = vtx.serialize();
    const signedBase64 = base64FromBytes(signed);

    const response = await fetch("/api/solana-send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signedBase64,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.signature || data.result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to send transaction: ${msg}`);
  }
}

export async function executeLimitOrder(
  session: BotSession,
  order: BotOrder,
  currentPrice: number,
  wallet: any,
): Promise<ExecutionResult> {
  try {
    console.log(
      `[MarketMakerExecutor] Attempting to execute ${order.type} order at price ${currentPrice}`,
      order,
    );

    // Validate order conditions
    if (order.type === "buy") {
      // For BUY: execute when current price <= target price
      if (currentPrice > order.buyPrice) {
        console.log(
          `[MarketMakerExecutor] Buy price condition not met: ${currentPrice} > ${order.buyPrice}`,
        );
        return {
          success: false,
          error: `Current price ${currentPrice} is above target ${order.buyPrice}`,
        };
      }
      console.log(
        `[MarketMakerExecutor] Buy price condition met: ${currentPrice} <= ${order.buyPrice}`,
      );
    } else {
      // For SELL: execute when current price >= target sell price
      if (currentPrice < order.targetSellPrice) {
        console.log(
          `[MarketMakerExecutor] Sell price condition not met: ${currentPrice} < ${order.targetSellPrice}`,
        );
        return {
          success: false,
          error: `Current price ${currentPrice} is below target ${order.targetSellPrice}`,
        };
      }
      console.log(
        `[MarketMakerExecutor] Sell price condition met: ${currentPrice} >= ${order.targetSellPrice}`,
      );
    }

    if (!wallet) {
      console.error("[MarketMakerExecutor] Wallet is null or undefined");
      return {
        success: false,
        error: "Wallet not available",
      };
    }

    if (!wallet.secretKey) {
      console.error(
        "[MarketMakerExecutor] Wallet does not have private key (secretKey). This is a view-only wallet.",
        {
          publicKey: wallet.publicKey,
          hasSecretKey: !!wallet.secretKey,
        },
      );
      return {
        success: false,
        error:
          "Cannot execute orders: wallet does not have private key access. Use a wallet with private keys.",
      };
    }

    let secretKeyArray: Uint8Array;
    if (wallet.secretKey instanceof Uint8Array) {
      secretKeyArray = wallet.secretKey;
    } else if (Array.isArray(wallet.secretKey)) {
      secretKeyArray = new Uint8Array(wallet.secretKey);
    } else {
      console.error(
        "[MarketMakerExecutor] Invalid secretKey format:",
        wallet.secretKey,
      );
      return {
        success: false,
        error: "Invalid wallet secret key format",
      };
    }

    const keypair = Keypair.fromSecretKey(secretKeyArray);
    const userPublicKey = wallet.publicKey || keypair.publicKey.toString();

    if (order.type === "buy") {
      // BUY: SOL -> FIXERCOIN
      const inputAmount = Math.floor(order.solAmount * 1e9); // Convert SOL to lamports
      const quote = await jupiterV6API.getQuote(
        SOL_MINT,
        FIXERCOIN_MINT,
        inputAmount,
        120, // 1.2% slippage
      );

      if (!quote) {
        return {
          success: false,
          error: "Failed to get quote from Jupiter",
        };
      }

      const swapTx = await jupiterV6API.createSwap(quote, userPublicKey, {
        wrapAndUnwrapSol: true,
      });

      if (!swapTx) {
        return {
          success: false,
          error: "Failed to get swap transaction",
        };
      }

      const signature = await sendSignedTx(swapTx.swapTransaction, keypair);

      // Update order with completion info
      const tokenAmount = parseInt(quote.outAmount) / Math.pow(10, 6); // FIXERCOIN has 6 decimals
      const completed = botOrdersStorage.completeBuyOrder(
        session.id,
        order.id,
        tokenAmount,
        signature,
      );

      if (completed) {
        console.log(
          `[MarketMakerExecutor] Buy order executed successfully: ${signature}`,
        );
        return {
          success: true,
          signature,
          order: {
            ...order,
            status: "completed",
            tokenAmount,
            signature,
          },
        };
      } else {
        return {
          success: false,
          error: "Failed to update order in storage",
        };
      }
    } else {
      // SELL: FIXERCOIN -> SOL or USDC (based on outputToken preference)
      const inputAmount = Math.floor((order.tokenAmount || 0) * 1e6); // Convert to FIXERCOIN units (6 decimals)
      const outputMint = order.outputToken === "USDC" ? USDC_MINT : SOL_MINT;
      const outputDecimals = order.outputToken === "USDC" ? 6 : 9;

      const quote = await jupiterV6API.getQuote(
        FIXERCOIN_MINT,
        outputMint,
        inputAmount,
        120, // 1.2% slippage
      );

      if (!quote) {
        return {
          success: false,
          error: "Failed to get quote from Jupiter",
        };
      }

      const swapTx = await jupiterV6API.createSwap(quote, userPublicKey, {
        wrapAndUnwrapSol: order.outputToken !== "USDC", // Only wrap/unwrap for SOL
        useSharedAccounts: order.outputToken === "SOL", // Don't use shared accounts for USDC to ensure account creation
      });

      if (!swapTx) {
        return {
          success: false,
          error: "Failed to get swap transaction",
        };
      }

      const signature = await sendSignedTx(swapTx.swapTransaction, keypair);

      // Update order with completion info
      const outputAmount =
        parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
      console.log(
        `[MarketMakerExecutor] Sell order output: ${outputAmount} ${order.outputToken || "SOL"} (quote.outAmount=${quote.outAmount}, decimals=${outputDecimals})`,
      );

      const completed = botOrdersStorage.completeSellOrder(
        session.id,
        order.id,
        outputAmount,
        signature,
      );

      if (completed) {
        console.log(
          `[MarketMakerExecutor] Sell order executed successfully: ${signature}`,
        );
        return {
          success: true,
          signature,
          order: {
            ...order,
            status: "completed",
            outputAmount,
            signature,
            outputToken: order.outputToken,
          },
        };
      } else {
        return {
          success: false,
          error: "Failed to update order in storage",
        };
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[MarketMakerExecutor] Execution error:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

export async function checkAndExecutePendingOrders(
  session: BotSession,
  currentPrice: number,
  wallet: any,
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  // Check buy orders
  for (const buyOrder of session.buyOrders) {
    if (buyOrder.status === "pending" && currentPrice <= buyOrder.buyPrice) {
      const result = await executeLimitOrder(
        session,
        buyOrder,
        currentPrice,
        wallet,
      );
      results.push(result);

      // Add a small delay between executions to avoid rate limiting
      if (result.success) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Check sell orders
  for (const sellOrder of session.sellOrders) {
    if (
      sellOrder.status === "pending" &&
      currentPrice >= sellOrder.targetSellPrice
    ) {
      const result = await executeLimitOrder(
        session,
        sellOrder,
        currentPrice,
        wallet,
      );
      results.push(result);

      // Add a small delay between executions to avoid rate limiting
      if (result.success) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return results;
}
