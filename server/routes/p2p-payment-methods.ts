import { RequestHandler } from "express";

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

export const handleGetPaymentMethods: RequestHandler = (req, res) => {
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
      const methods = Array.from(paymentMethods.values()).filter(
        (m) => m.walletAddress === walletAddress,
      );
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

export const handleSavePaymentMethod: RequestHandler = (req, res) => {
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

    paymentMethods.set(id, method);

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

export const handleDeletePaymentMethod: RequestHandler = (req, res) => {
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

    paymentMethods.delete(id);

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
