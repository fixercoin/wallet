/**
 * Client-side SPL Token Transfer Utilities
 * Handles building and managing token transfer transactions for staking
 */

import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";

const RPC_ENDPOINTS = [
  "https://solana.publicnode.com",
  "https://api.solflare.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
  "https://api.marinade.finance/rpc",
];

let connectionInstance: Connection | null = null;

function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(RPC_ENDPOINTS[0], "confirmed");
  }
  return connectionInstance;
}

export interface TransferParams {
  fromWallet: PublicKey;
  toWallet: PublicKey;
  mint: PublicKey;
  amount: number;
  decimals: number;
}

/**
 * Create a transfer instruction for SPL tokens
 */
async function createTransferInstruction_(params: TransferParams): Promise<{
  instruction: any;
  fromATA: PublicKey;
  toATA: PublicKey;
}> {
  const { fromWallet, toWallet, mint, amount, decimals } = params;

  // Get associated token accounts
  const fromATA = await getAssociatedTokenAddress(mint, fromWallet);
  const toATA = await getAssociatedTokenAddress(mint, toWallet);

  // Convert amount to base units
  const amountInBaseUnits = Math.floor(amount * Math.pow(10, decimals));

  // Create transfer instruction
  const instruction = createTransferInstruction(
    fromATA,
    toATA,
    fromWallet,
    amountInBaseUnits,
  );

  return {
    instruction,
    fromATA,
    toATA,
  };
}

/**
 * Build a token transfer transaction
 */
export async function buildTokenTransferTransaction(
  params: TransferParams,
): Promise<Transaction> {
  const conn = getConnection();
  const { fromWallet } = params;

  // Get recent blockhash
  const { blockhash } = await conn.getLatestBlockhash("confirmed");

  // Create transfer instruction
  const { instruction } = await createTransferInstruction_(params);

  // Build transaction
  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromWallet,
  }).add(instruction);

  return transaction;
}

/**
 * Send a transaction using Fixorium provider
 */
export async function sendTokenTransferTransaction(
  transaction: Transaction,
  provider: any, // FixoriumProvider
): Promise<string> {
  if (!provider) {
    throw new Error("Wallet provider not available");
  }

  // Ensure wallet is connected
  await provider.connect();

  // Serialize transaction to base64
  const txBuffer = Buffer.from(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
  );
  const txBase64 = txBuffer.toString("base64");

  // Send transaction using provider
  const signature = await provider.sendTransaction(txBase64);

  if (!signature) {
    throw new Error("Failed to get transaction signature");
  }

  return signature as string;
}

/**
 * Confirm a transaction on the blockchain
 */
export async function confirmTokenTransfer(
  signature: string,
  maxRetries: number = 30,
): Promise<boolean> {
  const conn = getConnection();
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const status = await conn.getSignatureStatus(signature);

      if (
        status.value?.confirmationStatus === "confirmed" ||
        status.value?.confirmationStatus === "finalized"
      ) {
        return true;
      }

      if (status.value?.err) {
        console.error("Transaction failed:", status.value.err);
        return false;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    } catch (error) {
      console.error("Error checking transaction status:", error);
      retries++;
    }
  }

  return false;
}

/**
 * Get token decimals for a mint
 * Falls back to 6 (common default) if unable to fetch
 */
export async function getTokenDecimals(mint: PublicKey): Promise<number> {
  try {
    const conn = getConnection();
    const mintInfo = await conn.getParsedAccountInfo(mint);

    if (
      mintInfo.value &&
      "parsed" in mintInfo.value.data &&
      "info" in mintInfo.value.data.parsed
    ) {
      return mintInfo.value.data.parsed.info.decimals;
    }
  } catch (error) {
    console.warn("Failed to get token decimals, using default 6:", error);
  }

  // Default to 6 decimals
  return 6;
}
