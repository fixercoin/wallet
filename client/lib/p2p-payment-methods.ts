/**
 * P2P Payment Methods Storage
 * Uses Cloudflare KV through API endpoints for persistent storage
 */

export interface PaymentMethod {
  id: string;
  walletAddress: string;
  userName: string;
  paymentMethod: "EASYPAISA";
  accountName: string;
  accountNumber: string;
  solanawWalletAddress: string;
  createdAt: number;
  updatedAt: number;
}

const API_BASE = "/api/p2p/payment-methods";

/**
 * Get all payment methods for a wallet
 */
export async function getPaymentMethodsByWallet(
  walletAddress: string,
): Promise<PaymentMethod[]> {
  try {
    const response = await fetch(
      `${API_BASE}?wallet=${encodeURIComponent(walletAddress)}`,
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch payment methods");
    }
    const result = await response.json();
    return result.data || [];
  } catch (e) {
    console.error("[P2P Payment Methods] Error getting methods:", e);
    return [];
  }
}

/**
 * Get a single payment method by ID
 */
export async function getPaymentMethod(id: string): Promise<PaymentMethod | null> {
  try {
    const response = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch payment method");
    }
    const result = await response.json();
    return result.data || null;
  } catch (e) {
    console.error("[P2P Payment Methods] Error getting payment method:", e);
    return null;
  }
}

/**
 * Create or update a payment method
 */
export async function savePaymentMethod(
  method: Omit<PaymentMethod, "id" | "createdAt" | "updatedAt">,
  id?: string,
): Promise<PaymentMethod> {
  try {
    const body = {
      walletAddress: method.walletAddress,
      userName: method.userName,
      paymentMethod: method.paymentMethod,
      accountName: method.accountName,
      accountNumber: method.accountNumber,
      solanawWalletAddress: method.solanawWalletAddress,
      methodId: id,
    };

    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save payment method");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Payment Methods] Error saving payment method:", e);
    throw e;
  }
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(
  id: string,
  walletAddress: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}?id=${encodeURIComponent(id)}&wallet=${encodeURIComponent(walletAddress)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete payment method");
    }
  } catch (e) {
    console.error("[P2P Payment Methods] Error deleting payment method:", e);
    throw e;
  }
}
