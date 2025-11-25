import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { WalletData } from "@/lib/wallet";

const FEE_WALLET = "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM";
const FEE_AMOUNT_SOL = 0.0007;
const LAMPORTS_PER_SOL = 1_000_000_000;

export const feeTransfer = {
  /**
   * Create a fee transfer transaction
   */
  createFeeTransferTx: (wallet: WalletData): Transaction | null => {
    try {
      if (!wallet.publicKey) return null;

      const transaction = new Transaction();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(wallet.publicKey),
          toPubkey: new PublicKey(FEE_WALLET),
          lamports: Math.floor(FEE_AMOUNT_SOL * LAMPORTS_PER_SOL),
        }),
      );

      return transaction;
    } catch (error) {
      console.error("Error creating fee transfer tx:", error);
      return null;
    }
  },

  /**
   * Estimate total SOL needed for trade + fee
   */
  getTotalSolNeeded: (tradeAmount: number): number => {
    return tradeAmount + FEE_AMOUNT_SOL;
  },

  /**
   * Check if wallet has enough SOL for trade + fee
   */
  hasEnoughSolForFee: (availableSol: number, tradeAmount: number): boolean => {
    return availableSol >= feeTransfer.getTotalSolNeeded(tradeAmount);
  },

  /**
   * Get fee amount in SOL
   */
  getFeeAmount: (): number => {
    return FEE_AMOUNT_SOL;
  },

  /**
   * Get fee wallet address
   */
  getFeeWallet: (): string => {
    return FEE_WALLET;
  },
};
