/**
 * P2P Transfer Logic
 * Handles cryptocurrency transfers for P2P orders using system accounts
 */

import { PublicKey } from "@solana/web3.js";
import { getSystemSellerWallet } from "@/lib/constants/system-config";
import type { CreatedOrder } from "@/lib/p2p-order-creation";

/**
 * Determine the recipient wallet for a P2P order transfer
 * For sell orders: the buyer receives from the system seller wallet
 * For buy orders: the system seller wallet receives from the seller
 */
export function getTransferRecipient(order: CreatedOrder): string {
  if (order.type === "BUY") {
    // For buy orders, the seller receives PKR, but crypto goes to system wallet
    return getSystemSellerWallet();
  } else {
    // For sell orders, buyer receives crypto
    return order.buyerWallet;
  }
}

/**
 * Determine the transfer sender for a P2P order
 * For sell orders: the seller sends crypto
 * For buy orders: the buyer sends to the system wallet
 */
export function getTransferSender(order: CreatedOrder): string {
  if (order.type === "BUY") {
    // For buy orders, buyer sends crypto to system wallet
    return order.buyerWallet;
  } else {
    // For sell orders, seller sends crypto
    return order.sellerWallet;
  }
}

/**
 * Get transfer details for a P2P order
 */
export interface P2PTransferDetails {
  sender: string;
  recipient: string;
  amount: number;
  token: string;
  orderId: string;
  orderType: "BUY" | "SELL";
  description: string;
}

export function getP2PTransferDetails(order: CreatedOrder): P2PTransferDetails {
  const sender = getTransferSender(order);
  const recipient = getTransferRecipient(order);

  return {
    sender,
    recipient,
    amount: order.amountTokens,
    token: order.token,
    orderId: order.id,
    orderType: order.type,
    description:
      order.type === "BUY"
        ? `Transfer ${order.amountTokens} ${order.token} to system wallet for order ${order.id}`
        : `Transfer ${order.amountTokens} ${order.token} to buyer for order ${order.id}`,
  };
}

/**
 * Validate transfer configuration
 */
export function validateTransferConfiguration(order: CreatedOrder): {
  valid: boolean;
  error?: string;
} {
  try {
    // Validate sender address
    new PublicKey(getTransferSender(order));

    // Validate recipient address
    new PublicKey(getTransferRecipient(order));

    // Validate amounts
    if (order.amountTokens <= 0) {
      return { valid: false, error: "Invalid token amount" };
    }

    if (!order.token) {
      return { valid: false, error: "Token not specified" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid wallet address: ${String(error)}`,
    };
  }
}

/**
 * Generate transfer instructions for a P2P order
 * This can be displayed to the user to show what will happen
 */
export function generateTransferInstructions(order: CreatedOrder): string[] {
  const sender = getTransferSender(order);
  const recipient = getTransferRecipient(order);

  if (order.type === "BUY") {
    return [
      `1. You will send ${order.amountTokens} ${order.token} from your wallet`,
      `2. The crypto will be received by the system wallet: ${recipient.slice(0, 8)}...${recipient.slice(-8)}`,
      `3. Once payment is confirmed, the system will process your order`,
      `4. The system will ensure you receive your ${order.token} tokens safely`,
    ];
  } else {
    return [
      `1. You will send ${order.amountTokens} ${order.token} to the system wallet`,
      `2. The system wallet address: ${getSystemSellerWallet().slice(0, 8)}...${getSystemSellerWallet().slice(-8)}`,
      `3. Once the buyer confirms payment, the system will transfer crypto to them`,
      `4. You will receive PKR ${order.amountPKR} through the agreed payment method`,
    ];
  }
}
