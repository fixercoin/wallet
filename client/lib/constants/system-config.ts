/**
 * System-wide P2P Configuration
 * Defines the system seller wallet and buyer account used for all P2P transactions
 */

export interface SystemBuyerAccount {
  accountName: string;
  accountNumber: string;
  paymentMethod: string;
}

export interface SystemP2PConfig {
  // System seller wallet address - receives crypto from sellers and sends to buyers
  sellerWallet: string;

  // System buyer account - receives PKR from buyers and sends crypto from this wallet
  buyerAccount: SystemBuyerAccount;

  // Whether to use system accounts for all P2P transactions
  enabled: boolean;
}

/**
 * System P2P Configuration
 * This wallet address acts as the intermediary for all P2P transactions:
 * - Sellers send crypto to this wallet
 * - This wallet sends crypto to buyers
 * - Buyers pay to the system buyer account
 * - System wallet pays sellers from received payments
 */
export const SYSTEM_P2P_CONFIG: SystemP2PConfig = {
  sellerWallet: "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw",
  buyerAccount: {
    accountName: "AMEER NAWAZ KHAN",
    accountNumber: "03107044833",
    paymentMethod: "EASYPAISA",
  },
  enabled: true,
};

/**
 * Get the system seller wallet address
 * This is used as the recipient for seller transfers and sender for buyer crypto
 */
export function getSystemSellerWallet(): string {
  return SYSTEM_P2P_CONFIG.sellerWallet;
}

/**
 * Get the system buyer account details
 * This is used for buyer payment instructions
 */
export function getSystemBuyerAccount(): SystemBuyerAccount {
  return SYSTEM_P2P_CONFIG.buyerAccount;
}

/**
 * Check if system P2P configuration is enabled
 */
export function isSystemP2PEnabled(): boolean {
  return SYSTEM_P2P_CONFIG.enabled;
}
