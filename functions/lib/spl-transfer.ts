/**
 * SPL Token Transfer Utilities
 * Handles actual on-chain token transfers for staking operations
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Connection,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
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

interface TransferInstruction {
  fromPublicKey: PublicKey;
  toPublicKey: PublicKey;
  amount: number;
  decimals: number;
  mint: PublicKey;
}

/**
 * Create a transfer instruction for SPL tokens
 * Does NOT sign or send - just creates the instruction
 */
export async function createSPLTransferInstruction(
  params: TransferInstruction,
): Promise<{
  instruction: any;
  fromATA: PublicKey;
  toATA: PublicKey;
}> {
  const { fromPublicKey, toPublicKey, amount, decimals, mint } = params;

  // Get associated token accounts
  const fromATA = await getAssociatedTokenAddress(mint, fromPublicKey);
  const toATA = await getAssociatedTokenAddress(mint, toPublicKey);

  // Convert amount to base units
  const amountInBaseUnits = Math.floor(amount * Math.pow(10, decimals));

  // Create transfer instruction
  const transferInstruction = createTransferInstruction(
    fromATA,
    toATA,
    fromPublicKey,
    amountInBaseUnits,
  );

  return {
    instruction: transferInstruction,
    fromATA,
    toATA,
  };
}

/**
 * Build a transaction for token transfer
 * The caller is responsible for signing with the payer/from account
 */
export async function buildTransferTransaction(
  params: TransferInstruction,
  recentBlockhash: string,
  feePayer: PublicKey,
): Promise<Transaction> {
  const { instruction, toATA } = await createSPLTransferInstruction(params);

  const transaction = new Transaction({
    recentBlockhash,
    feePayer,
  });

  // Check if recipient's ATA exists, if not add instruction to create it
  try {
    const conn = getConnection();
    const { mint, toPublicKey } = params;
    const ata = await getAssociatedTokenAddress(mint, toPublicKey);
    await getAccount(conn, ata);
  } catch {
    // ATA doesn't exist, would need to be created
    // This should be handled by the client or a separate call
    console.log(
      "Recipient ATA might not exist - client should create it first",
    );
  }

  transaction.add(instruction);
  return transaction;
}

/**
 * Get recent blockhash for transaction
 */
export async function getRecentBlockhash(): Promise<string> {
  const conn = getConnection();
  const blockhash = await conn.getLatestBlockhash();
  return blockhash.blockhash;
}

/**
 * Confirm a transaction on the blockchain
 */
export async function confirmTransaction(
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
 * Get token account balance
 */
export async function getTokenBalance(
  walletAddress: PublicKey,
  mint: PublicKey,
): Promise<number> {
  try {
    const conn = getConnection();
    const ata = await getAssociatedTokenAddress(mint, walletAddress);
    const account = await getAccount(conn, ata);
    return Number(account.amount);
  } catch (error) {
    console.error("Error getting token balance:", error);
    return 0;
  }
}
