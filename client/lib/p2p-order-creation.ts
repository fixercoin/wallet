import { createTradeRoom, addTradeMessage } from "./p2p-api";
import { getPaymentMethodsByWallet } from "./p2p-payment-methods";

export interface P2POfferFromTable {
  id: string;
  type: "BUY" | "SELL";
  walletAddress?: string;
  creator_wallet?: string;
  token: string;
  amountTokens?: number;
  token_amount?: string;
  amountPKR?: number;
  pkr_amount?: number;
  minAmountPKR?: number;
  maxAmountPKR?: number;
  minAmountTokens?: number;
  maxAmountTokens?: number;
  pricePKRPerQuote?: number;
  payment_method?: string;
  paymentMethodId?: string;
  status?: string;
  createdAt?: number;
  created_at?: number;
}

export interface CreatedOrder {
  id: string;
  type: "BUY" | "SELL";
  offerId: string;
  buyerWallet: string;
  sellerWallet: string;
  token: string;
  amountTokens: number;
  amountPKR: number;
  pricePKRPerQuote: number;
  payment_method: string;
  sellerPaymentMethod?: {
    accountName: string;
    accountNumber: string;
  };
  status: "PENDING" | "PAYMENT_CONFIRMED" | "COMPLETED" | "CANCELLED";
  createdAt: number;
  roomId?: string;
  buyerPaymentConfirmed?: boolean;
  sellerPaymentReceived?: boolean;
  sellerTransferInitiated?: boolean;
  buyerCryptoReceived?: boolean;
}

export interface TradeDetailsInput {
  token: string;
  amountTokens: number;
  amountPKR: number;
  price: number;
}

export async function createOrderFromOffer(
  offer: P2POfferFromTable,
  currentUserWallet: string,
  orderType: "BUY" | "SELL",
  tradeDetails?: TradeDetailsInput,
): Promise<CreatedOrder> {
  const offerCreatorWallet = offer.walletAddress || offer.creator_wallet || "";

  // Use trade details if provided (from dialog), otherwise use offer details
  const amountTokens =
    tradeDetails?.amountTokens ||
    (typeof offer.amountTokens === "number"
      ? offer.amountTokens
      : typeof offer.token_amount === "string"
        ? parseFloat(offer.token_amount)
        : 0);
  const amountPKR =
    tradeDetails?.amountPKR ||
    (typeof offer.amountPKR === "number"
      ? offer.amountPKR
      : typeof offer.pkr_amount === "number"
        ? offer.pkr_amount
        : 0);
  const pricePKRPerQuote = tradeDetails?.price || offer.pricePKRPerQuote || 280;

  const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Determine buyer and seller based on order type
  let buyerWallet: string;
  let sellerWallet: string;
  let sellerPaymentMethod = undefined;

  if (orderType === "BUY") {
    // User is buying: they are the buyer, offer creator is the seller
    buyerWallet = currentUserWallet;
    sellerWallet = offerCreatorWallet;

    // For buyers with a specific seller, we need seller's payment method
    if (sellerWallet && sellerWallet.trim()) {
      try {
        const paymentMethods = await getPaymentMethodsByWallet(sellerWallet);
        if (paymentMethods.length > 0) {
          const pm = paymentMethods[0];
          sellerPaymentMethod = {
            accountName: pm.accountName,
            accountNumber: pm.accountNumber,
          };
        }
      } catch (error) {
        console.error("Failed to get seller payment method:", error);
      }
    }
  } else {
    // User is selling: they are the seller, offer creator is the buyer
    buyerWallet = offerCreatorWallet;
    sellerWallet = currentUserWallet;

    // For sellers, fetch their own payment method
    if (sellerWallet && sellerWallet.trim()) {
      try {
        const paymentMethods = await getPaymentMethodsByWallet(sellerWallet);
        if (paymentMethods.length > 0) {
          const pm = paymentMethods[0];
          sellerPaymentMethod = {
            accountName: pm.accountName,
            accountNumber: pm.accountNumber,
          };
        }
      } catch (error) {
        console.error("Failed to get seller payment method:", error);
      }
    }
  }

  // Create trade room only if both buyer and seller wallets are valid
  let roomId = undefined;
  if (
    buyerWallet &&
    buyerWallet.trim() &&
    sellerWallet &&
    sellerWallet.trim()
  ) {
    try {
      const room = await createTradeRoom({
        buyer_wallet: buyerWallet,
        seller_wallet: sellerWallet,
        order_id: orderId,
      });
      roomId = room.id;

      // Add initial message
      await addTradeMessage({
        room_id: roomId,
        sender_wallet: currentUserWallet,
        message: `Order created: ${orderType} order for ${amountTokens} ${offer.token}`,
      });
    } catch (error) {
      console.error("Failed to create trade room:", error);
    }
  }

  // Save order to localStorage as backup (if no backend storage)
  const order: CreatedOrder = {
    id: orderId,
    type: orderType,
    offerId: offer.id,
    buyerWallet,
    sellerWallet,
    token: offer.token,
    amountTokens,
    amountPKR,
    pricePKRPerQuote,
    payment_method: offer.payment_method || "EASYPAISA",
    sellerPaymentMethod,
    status: "PENDING",
    createdAt: Date.now(),
    roomId,
  };

  // Store in localStorage
  try {
    const ordersJson = localStorage.getItem("p2p_orders") || "[]";
    const orders = JSON.parse(ordersJson);
    orders.push(order);
    localStorage.setItem("p2p_orders", JSON.stringify(orders));
  } catch (error) {
    console.error("Failed to store order:", error);
  }

  return order;
}

export function getOrderFromStorage(orderId: string): CreatedOrder | null {
  try {
    const ordersJson = localStorage.getItem("p2p_orders") || "[]";
    const orders = JSON.parse(ordersJson);
    return orders.find((o: CreatedOrder) => o.id === orderId) || null;
  } catch (error) {
    console.error("Failed to get order from storage:", error);
    return null;
  }
}

export function updateOrderInStorage(
  orderId: string,
  updates: Partial<CreatedOrder>,
): CreatedOrder | null {
  try {
    const ordersJson = localStorage.getItem("p2p_orders") || "[]";
    const orders = JSON.parse(ordersJson);
    const index = orders.findIndex((o: CreatedOrder) => o.id === orderId);

    if (index === -1) return null;

    const updatedOrder = { ...orders[index], ...updates };
    orders[index] = updatedOrder;
    localStorage.setItem("p2p_orders", JSON.stringify(orders));

    return updatedOrder;
  } catch (error) {
    console.error("Failed to update order:", error);
    return null;
  }
}
