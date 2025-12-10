import { RequestHandler } from "express";
import { getKVStorage } from "../lib/kv-storage";

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

const paymentMethods: Map<string, PaymentMethod> = new Map();

function generateId(): string {
  return `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to get all payment methods for a wallet from KV storage
async function getWalletPaymentMethods(
  walletAddress: string,
): Promise<PaymentMethod[]> {
  const kv = getKVStorage();
  const key = `payment_methods:${walletAddress}`;
  const json = await kv.get(key);
  if (!json) return [];

  try {
    const methods = JSON.parse(json);
    return Array.isArray(methods) ? methods : [];
  } catch {
    return [];
  }
}

// Helper to save payment methods to KV storage
async function saveWalletPaymentMethods(
  walletAddress: string,
  methods: PaymentMethod[],
): Promise<void> {
  const kv = getKVStorage();
  const key = `payment_methods:${walletAddress}`;
  await kv.put(key, JSON.stringify(methods));
}

export const handleGetPaymentMethods: RequestHandler = async (req, res) => {
  try {
    const id = req.query.id as string | undefined;
    const walletAddress = req.query.wallet as string | undefined;

    if (id) {
      const method = paymentMethods.get(id);
      if (!method) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      return res.json({ data: method });
    }

    if (walletAddress) {
      // Fetch from KV storage (persistent)
      const methods = await getWalletPaymentMethods(walletAddress);
      return res.json({ data: methods });
    }

    return res.status(400).json({
      error: "Missing required query parameter: id or wallet",
    });
  } catch (error) {
    console.error("[Payment Methods] Error fetching:", error);
    return res.status(500).json({
      error: "Failed to fetch payment methods",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleSavePaymentMethod: RequestHandler = async (req, res) => {
  try {
    const {
      walletAddress,
      userName,
      paymentMethod,
      accountName,
      accountNumber,
      solanawWalletAddress,
      methodId,
    } = req.body;

    if (
      !walletAddress ||
      !userName ||
      !paymentMethod ||
      !accountName ||
      !accountNumber ||
      !solanawWalletAddress
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "walletAddress",
          "userName",
          "paymentMethod",
          "accountName",
          "accountNumber",
          "solanawWalletAddress",
        ],
      });
    }

    const now = Date.now();
    const id = methodId || generateId();

    const method: PaymentMethod = {
      id,
      walletAddress,
      userName,
      paymentMethod,
      accountName,
      accountNumber,
      solanawWalletAddress,
      createdAt: paymentMethods.has(id)
        ? paymentMethods.get(id)!.createdAt
        : now,
      updatedAt: now,
    };

    // Save to in-memory map for backward compatibility
    paymentMethods.set(id, method);

    // Save to KV storage (persistent) for order creation checks
    try {
      const existingMethods = await getWalletPaymentMethods(walletAddress);
      const methodIndex = existingMethods.findIndex((m) => m.id === id);
      if (methodIndex >= 0) {
        existingMethods[methodIndex] = method;
      } else {
        existingMethods.push(method);
      }
      await saveWalletPaymentMethods(walletAddress, existingMethods);
    } catch (kvError) {
      console.warn(
        "[Payment Methods] Warning: Could not save to persistent KV storage, using in-memory only:",
        kvError instanceof Error ? kvError.message : String(kvError),
      );
      // Continue anyway - the in-memory store will work for this session
    }

    return res.json({
      data: method,
      message: "Payment method saved successfully",
    });
  } catch (error) {
    console.error("[Payment Methods] Error saving:", error);
    return res.status(500).json({
      error: "Failed to save payment method",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleDeletePaymentMethod: RequestHandler = async (req, res) => {
  try {
    const id = req.query.id as string | undefined;
    const walletAddress = req.query.wallet as string | undefined;

    if (!id || !walletAddress) {
      return res.status(400).json({
        error: "Missing required query parameters: id and wallet",
      });
    }

    const method = paymentMethods.get(id);
    if (!method) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    if (method.walletAddress !== walletAddress) {
      return res.status(403).json({
        error: "Unauthorized - payment method does not belong to this wallet",
      });
    }

    // Delete from in-memory map
    paymentMethods.delete(id);

    // Delete from KV storage
    const existingMethods = await getWalletPaymentMethods(walletAddress);
    const filtered = existingMethods.filter((m) => m.id !== id);
    await saveWalletPaymentMethods(walletAddress, filtered);

    return res.json({
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    console.error("[Payment Methods] Error deleting:", error);
    return res.status(500).json({
      error: "Failed to delete payment method",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
