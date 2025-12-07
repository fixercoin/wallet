/**
 * Vault Transfer Utilities
 * Handles signing and sending transactions from the vault wallet
 *
 * WARNING: This requires the vault private key to be stored securely
 * in environment variables. Never commit private keys to version control.
 * Use secure vaults like Cloudflare Secrets or environment variable services.
 */

import {
  PublicKey,
  Transaction,
  Connection,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";

const RPC_ENDPOINTS = [
  "https://solana.publicnode.com",
  "https://api.solflare.com",
  "https://rpc.ankr.com/solana",
  "https://rpc.ironforge.network/mainnet",
  "https://api.mainnet-beta.solana.com",
];

let connectionInstance: Connection | null = null;

function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(RPC_ENDPOINTS[0], "confirmed");
  }
  return connectionInstance;
}

/**
 * Get vault keypair from environment variable
 * The private key should be stored as base58-encoded string
 */
function getVaultKeypair(vaultPrivateKeyBase58: string): Keypair {
  try {
    const privateKeyBytes = bs58.decode(vaultPrivateKeyBase58);
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    throw new Error(
      "Invalid vault private key format. Should be base58-encoded",
    );
  }
}

export interface WithdrawalTransferParams {
  vaultPrivateKeyBase58: string; // Base58-encoded private key (from env)
  recipientWallet: PublicKey;
  mint: PublicKey;
  amount: number;
  decimals: number;
}

/**
 * Sign and send a withdrawal transfer from vault to recipient
 * Returns the transaction signature
 */
export async function signAndSendVaultTransfer(
  params: WithdrawalTransferParams,
): Promise<string> {
  const { vaultPrivateKeyBase58, recipientWallet, mint, amount, decimals } =
    params;

  try {
    // Get vault keypair from private key
    const vaultKeypair = getVaultKeypair(vaultPrivateKeyBase58);
    const vaultPublicKey = vaultKeypair.publicKey;

    const conn = getConnection();

    // Get associated token accounts
    const vaultATA = await getAssociatedTokenAddress(mint, vaultPublicKey);
    const recipientATA = await getAssociatedTokenAddress(mint, recipientWallet);

    // Convert amount to base units
    const amountInBaseUnits = Math.floor(amount * Math.pow(10, decimals));

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      vaultATA,
      recipientATA,
      vaultPublicKey,
      amountInBaseUnits,
    );

    // Create and sign transaction
    const transaction = new Transaction().add(transferInstruction);

    // Get recent blockhash
    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = vaultPublicKey;

    // Sign with vault keypair
    transaction.sign(vaultKeypair);

    // Send transaction
    const signature = await conn.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    const confirmation = await conn.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return signature;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Vault transfer failed: ${msg}`);
  }
}

/**
 * Validate that vault has enough tokens for withdrawal
 */
export async function validateVaultBalance(
  vaultPrivateKeyBase58: string,
  mint: PublicKey,
  requiredAmount: number,
  decimals: number,
): Promise<boolean> {
  try {
    const vaultKeypair = getVaultKeypair(vaultPrivateKeyBase58);
    const conn = getConnection();

    const ata = await getAssociatedTokenAddress(mint, vaultKeypair.publicKey);
    const accountInfo = await conn.getParsedAccountInfo(ata);

    if (!accountInfo.value) {
      return false;
    }

    const balance =
      (accountInfo.value.data as any).parsed?.info?.tokenAmount?.uiAmount || 0;
    const requiredUiAmount = requiredAmount / Math.pow(10, decimals);

    return balance >= requiredUiAmount;
  } catch (error) {
    console.error("Error validating vault balance:", error);
    return false;
  }
}
