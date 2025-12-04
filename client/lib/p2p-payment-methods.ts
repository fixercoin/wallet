/**
 * P2P Payment Methods Storage
 * Uses localStorage to store user payment method information
 * Similar to KV store pattern for consistent data management
 */

export interface PaymentMethod {
  id: string;
  walletAddress: string;
  userName: string;
  paymentMethod: "EASYPAISA"; // Only EASYPAISA for now
  accountName: string;
  accountNumber: string;
  solanawWalletAddress: string;
  createdAt: number;
  updatedAt: number;
}

const PAYMENT_METHODS_KEY = "p2p:payment_methods";
const PAYMENT_METHOD_IDS_KEY = (walletAddress: string) =>
  `p2p:payment_method_ids:${walletAddress}`;

/**
 * Get all payment methods for a wallet
 */
export function getPaymentMethodsByWallet(
  walletAddress: string,
): PaymentMethod[] {
  try {
    const ids = JSON.parse(
      localStorage.getItem(PAYMENT_METHOD_IDS_KEY(walletAddress)) || "[]",
    );
    const methods: PaymentMethod[] = [];

    for (const id of ids) {
      const method = getPaymentMethod(id);
      if (method) {
        methods.push(method);
      }
    }

    return methods;
  } catch (e) {
    console.error("[P2P Payment Methods] Error getting methods:", e);
    return [];
  }
}

/**
 * Get a single payment method by ID
 */
export function getPaymentMethod(id: string): PaymentMethod | null {
  try {
    const json = localStorage.getItem(`${PAYMENT_METHODS_KEY}:${id}`);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error("[P2P Payment Methods] Error getting payment method:", e);
    return null;
  }
}

/**
 * Create or update a payment method
 */
export function savePaymentMethod(
  method: Omit<PaymentMethod, "id" | "createdAt" | "updatedAt">,
  id?: string,
): PaymentMethod {
  try {
    const methodId = id || `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const paymentMethod: PaymentMethod = {
      ...method,
      id: methodId,
      createdAt: id ? getPaymentMethod(id)?.createdAt || now : now,
      updatedAt: now,
    };

    localStorage.setItem(
      `${PAYMENT_METHODS_KEY}:${methodId}`,
      JSON.stringify(paymentMethod),
    );

    // Add to wallet's payment method list
    const ids = JSON.parse(
      localStorage.getItem(
        PAYMENT_METHOD_IDS_KEY(method.walletAddress),
      ) || "[]",
    );

    if (!ids.includes(methodId)) {
      ids.push(methodId);
      localStorage.setItem(
        PAYMENT_METHOD_IDS_KEY(method.walletAddress),
        JSON.stringify(ids),
      );
    }

    return paymentMethod;
  } catch (e) {
    console.error("[P2P Payment Methods] Error saving payment method:", e);
    throw e;
  }
}

/**
 * Delete a payment method
 */
export function deletePaymentMethod(
  id: string,
  walletAddress: string,
): void {
  try {
    localStorage.removeItem(`${PAYMENT_METHODS_KEY}:${id}`);

    const ids = JSON.parse(
      localStorage.getItem(PAYMENT_METHOD_IDS_KEY(walletAddress)) || "[]",
    );
    const filtered = ids.filter((methodId: string) => methodId !== id);
    localStorage.setItem(
      PAYMENT_METHOD_IDS_KEY(walletAddress),
      JSON.stringify(filtered),
    );
  } catch (e) {
    console.error("[P2P Payment Methods] Error deleting payment method:", e);
  }
}
