import { RequestHandler } from "express";
import { getKVStorage } from "../lib/kv-storage";

// Admin wallet addresses (from environment or hardcoded defaults)
// Set FIAT_ADMIN_WALLETS environment variable with comma-separated wallet addresses
// Example: FIAT_ADMIN_WALLETS="wallet1,wallet2,wallet3"
const ADMIN_WALLETS = process.env.FIAT_ADMIN_WALLETS
  ? process.env.FIAT_ADMIN_WALLETS.split(",").map((w) => w.trim())
  : [
      "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw", // Admin wallet
      // Add more admin wallets as needed
    ];

// Transaction types
export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  EXCHANGE = "exchange",
}

export interface UserBalance {
  wallet: string;
  usdt: number;
  pkr: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  wallet: string;
  type: TransactionType;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  timestamp: string;
  status: "pending" | "completed" | "failed";
  paymentMethod?: string;
  notes?: string;
}

export interface PriceRatio {
  usdtToPkr: number;
  pkrToUsdt: number;
  updatedBy: string;
  timestamp: string;
}

// Get user balance from KV
async function getUserBalance(wallet: string): Promise<UserBalance> {
  const kv = getKVStorage();
  const key = `balance:${wallet}`;
  const json = await kv.get(key);

  if (!json) {
    return {
      wallet,
      usdt: 0,
      pkr: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  return JSON.parse(json);
}

// Save user balance to KV
async function saveUserBalance(balance: UserBalance): Promise<void> {
  const kv = getKVStorage();
  const key = `balance:${balance.wallet}`;
  await kv.put(key, JSON.stringify(balance));
}

// Get price ratio
async function getPriceRatio(): Promise<PriceRatio> {
  const kv = getKVStorage();
  const json = await kv.get("price_ratio");

  if (!json) {
    // Default ratio: 1 USDT = 277 PKR
    return {
      usdtToPkr: 277,
      pkrToUsdt: 1 / 277,
      updatedBy: "system",
      timestamp: new Date().toISOString(),
    };
  }

  return JSON.parse(json);
}

// Save price ratio (admin only)
async function savePriceRatio(ratio: PriceRatio): Promise<void> {
  const kv = getKVStorage();
  await kv.put("price_ratio", JSON.stringify(ratio));
}

// Save transaction
async function saveTransaction(transaction: Transaction): Promise<void> {
  const kv = getKVStorage();
  const key = `transaction:${transaction.id}`;
  await kv.put(key, JSON.stringify(transaction));

  // Also save transaction to wallet's transaction list
  const walletKey = `transactions:${transaction.wallet}`;
  const existingJson = await kv.get(walletKey);
  const txIds = existingJson ? JSON.parse(existingJson) : [];
  txIds.push(transaction.id);
  await kv.put(walletKey, JSON.stringify(txIds));
}

// Get user transactions
async function getUserTransactions(wallet: string): Promise<Transaction[]> {
  const kv = getKVStorage();
  const walletKey = `transactions:${wallet}`;
  const json = await kv.get(walletKey);

  if (!json) return [];

  const txIds = JSON.parse(json);
  const transactions: Transaction[] = [];

  for (const txId of txIds) {
    const txJson = await kv.get(`transaction:${txId}`);
    if (txJson) {
      transactions.push(JSON.parse(txJson));
    }
  }

  return transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

// Check if wallet is admin
function isAdmin(wallet: string): boolean {
  return ADMIN_WALLETS.includes(wallet);
}

// Get user balance
export const handleGetBalance: RequestHandler = async (req, res) => {
  try {
    const wallet = req.query.wallet as string;

    if (!wallet) {
      return res.status(400).json({
        error: "Missing wallet parameter",
      });
    }

    const balance = await getUserBalance(wallet);
    return res.json(balance);
  } catch (error) {
    console.error("[Fiat System] Error getting balance:", error);
    return res.status(500).json({
      error: "Failed to get balance",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Deposit USDT or PKR
export const handleDeposit: RequestHandler = async (req, res) => {
  try {
    const { wallet, currency, amount, paymentMethod } = req.body;

    if (!wallet || !currency || !amount) {
      return res.status(400).json({
        error: "Missing required fields: wallet, currency, amount",
      });
    }

    if (!["USDT", "PKR"].includes(currency)) {
      return res.status(400).json({
        error: "Invalid currency. Must be USDT or PKR",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    const balance = await getUserBalance(wallet);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update balance
    if (currency === "USDT") {
      balance.usdt += amount;
    } else {
      balance.pkr += amount;
    }

    balance.lastUpdated = new Date().toISOString();
    await saveUserBalance(balance);

    // Record transaction
    const transaction: Transaction = {
      id: txId,
      wallet,
      type: TransactionType.DEPOSIT,
      fromCurrency: currency,
      toCurrency: currency,
      fromAmount: amount,
      toAmount: amount,
      timestamp: new Date().toISOString(),
      status: "completed",
      paymentMethod,
    };

    await saveTransaction(transaction);

    return res.json({
      success: true,
      message: `Deposited ${amount} ${currency}`,
      balance,
      transaction,
    });
  } catch (error) {
    console.error("[Fiat System] Error processing deposit:", error);
    return res.status(500).json({
      error: "Failed to process deposit",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Withdraw USDT or PKR
export const handleWithdraw: RequestHandler = async (req, res) => {
  try {
    const { wallet, currency, amount, paymentMethod } = req.body;

    if (!wallet || !currency || !amount) {
      return res.status(400).json({
        error: "Missing required fields: wallet, currency, amount",
      });
    }

    if (!["USDT", "PKR"].includes(currency)) {
      return res.status(400).json({
        error: "Invalid currency. Must be USDT or PKR",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    const balance = await getUserBalance(wallet);

    // Check sufficient balance
    const currentBalance = currency === "USDT" ? balance.usdt : balance.pkr;

    if (currentBalance < amount) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${currentBalance} ${currency}`,
      });
    }

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update balance
    if (currency === "USDT") {
      balance.usdt -= amount;
    } else {
      balance.pkr -= amount;
    }

    balance.lastUpdated = new Date().toISOString();
    await saveUserBalance(balance);

    // Record transaction
    const transaction: Transaction = {
      id: txId,
      wallet,
      type: TransactionType.WITHDRAW,
      fromCurrency: currency,
      toCurrency: currency,
      fromAmount: amount,
      toAmount: amount,
      timestamp: new Date().toISOString(),
      status: "completed",
      paymentMethod,
    };

    await saveTransaction(transaction);

    return res.json({
      success: true,
      message: `Withdrawn ${amount} ${currency}`,
      balance,
      transaction,
    });
  } catch (error) {
    console.error("[Fiat System] Error processing withdrawal:", error);
    return res.status(500).json({
      error: "Failed to process withdrawal",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Exchange USDT to PKR or vice versa
export const handleExchange: RequestHandler = async (req, res) => {
  try {
    const { wallet, fromCurrency, toAmount } = req.body;

    if (!wallet || !fromCurrency || toAmount === undefined) {
      return res.status(400).json({
        error: "Missing required fields: wallet, fromCurrency, toAmount",
      });
    }

    if (!["USDT", "PKR"].includes(fromCurrency)) {
      return res.status(400).json({
        error: "Invalid currency. Must be USDT or PKR",
      });
    }

    const toCurrency = fromCurrency === "USDT" ? "PKR" : "USDT";

    if (toAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    const priceRatio = await getPriceRatio();
    let fromAmount: number;

    // Calculate exchange amount
    if (fromCurrency === "USDT") {
      fromAmount = toAmount / priceRatio.usdtToPkr;
    } else {
      fromAmount = toAmount * priceRatio.pkrToUsdt;
    }

    const balance = await getUserBalance(wallet);

    // Check sufficient balance
    if (fromCurrency === "USDT" && balance.usdt < fromAmount) {
      return res.status(400).json({
        error: `Insufficient USDT balance. You have ${balance.usdt} USDT`,
      });
    }

    if (fromCurrency === "PKR" && balance.pkr < fromAmount) {
      return res.status(400).json({
        error: `Insufficient PKR balance. You have ${balance.pkr} PKR`,
      });
    }

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update balance
    if (fromCurrency === "USDT") {
      balance.usdt -= fromAmount;
      balance.pkr += toAmount;
    } else {
      balance.pkr -= fromAmount;
      balance.usdt += toAmount;
    }

    balance.lastUpdated = new Date().toISOString();
    await saveUserBalance(balance);

    // Record transaction
    const transaction: Transaction = {
      id: txId,
      wallet,
      type: TransactionType.EXCHANGE,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    await saveTransaction(transaction);

    return res.json({
      success: true,
      message: `Exchanged ${fromAmount} ${fromCurrency} for ${toAmount} ${toCurrency}`,
      balance,
      transaction,
    });
  } catch (error) {
    console.error("[Fiat System] Error processing exchange:", error);
    return res.status(500).json({
      error: "Failed to process exchange",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Get price ratio
export const handleGetPriceRatio: RequestHandler = async (req, res) => {
  try {
    const ratio = await getPriceRatio();
    return res.json(ratio);
  } catch (error) {
    console.error("[Fiat System] Error getting price ratio:", error);
    return res.status(500).json({
      error: "Failed to get price ratio",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Update price ratio (admin only)
export const handleUpdatePriceRatio: RequestHandler = async (req, res) => {
  try {
    const { wallet, usdtToPkr } = req.body;

    if (!wallet || usdtToPkr === undefined) {
      return res.status(400).json({
        error: "Missing required fields: wallet, usdtToPkr",
      });
    }

    if (!isAdmin(wallet)) {
      return res.status(403).json({
        error: "Unauthorized. Only admins can update price ratio",
      });
    }

    if (usdtToPkr <= 0) {
      return res.status(400).json({
        error: "Price ratio must be greater than 0",
      });
    }

    const ratio: PriceRatio = {
      usdtToPkr,
      pkrToUsdt: 1 / usdtToPkr,
      updatedBy: wallet,
      timestamp: new Date().toISOString(),
    };

    await savePriceRatio(ratio);

    return res.json({
      success: true,
      message: "Price ratio updated",
      ratio,
    });
  } catch (error) {
    console.error("[Fiat System] Error updating price ratio:", error);
    return res.status(500).json({
      error: "Failed to update price ratio",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Get user transactions
export const handleGetTransactions: RequestHandler = async (req, res) => {
  try {
    const wallet = req.query.wallet as string;

    if (!wallet) {
      return res.status(400).json({
        error: "Missing wallet parameter",
      });
    }

    const transactions = await getUserTransactions(wallet);
    return res.json({ transactions });
  } catch (error) {
    console.error("[Fiat System] Error getting transactions:", error);
    return res.status(500).json({
      error: "Failed to get transactions",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Payment Method Interface
export interface PaymentMethod {
  id: string;
  wallet: string;
  userId: string;
  name: string;
  idCard: string;
  password: string;
  walletAddress: string;
  createdAt: string;
  lastUsed?: string;
}

// Generate unique user ID
function generateUserId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < 3; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  id += "-";

  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id.toUpperCase();
}

// Check if ID card is already registered
async function isIdCardRegistered(idCard: string): Promise<boolean> {
  const kv = getKVStorage();
  const key = `idcard:${idCard}`;
  const result = await kv.get(key);
  return result !== null;
}

// Get payment method by ID card
async function getPaymentMethodByIdCard(
  idCard: string,
): Promise<PaymentMethod | null> {
  const kv = getKVStorage();
  const key = `idcard:${idCard}`;
  const methodId = await kv.get(key);

  if (!methodId) return null;

  const methodJson = await kv.get(`payment_method:${methodId}`);
  if (!methodJson) return null;

  return JSON.parse(methodJson);
}

// Save payment method
async function savePaymentMethod(method: PaymentMethod): Promise<void> {
  const kv = getKVStorage();

  // Save method
  await kv.put(`payment_method:${method.id}`, JSON.stringify(method));

  // Save ID card index for duplicate checking
  await kv.put(`idcard:${method.idCard}`, method.id);

  // Add to wallet's payment methods list
  const walletKey = `payment_methods:${method.wallet}`;
  const existingJson = await kv.get(walletKey);
  const methodIds = existingJson ? JSON.parse(existingJson) : [];

  if (!methodIds.includes(method.id)) {
    methodIds.push(method.id);
    await kv.put(walletKey, JSON.stringify(methodIds));
  }
}

// Get wallet's payment methods
async function getWalletPaymentMethods(
  wallet: string,
): Promise<PaymentMethod[]> {
  const kv = getKVStorage();
  const walletKey = `payment_methods:${wallet}`;
  const json = await kv.get(walletKey);

  if (!json) return [];

  const methodIds = JSON.parse(json);
  const methods: PaymentMethod[] = [];

  for (const methodId of methodIds) {
    const methodJson = await kv.get(`payment_method:${methodId}`);
    if (methodJson) {
      methods.push(JSON.parse(methodJson));
    }
  }

  return methods;
}

// Get latest payment method for wallet
async function getLatestPaymentMethod(
  wallet: string,
): Promise<PaymentMethod | null> {
  const methods = await getWalletPaymentMethods(wallet);
  if (methods.length === 0) return null;
  return methods[methods.length - 1];
}

// Save payment method endpoint
export const handleSavePaymentMethod: RequestHandler = async (req, res) => {
  try {
    const { wallet, name, idCard, password, walletAddress } = req.body;

    if (!wallet || !name || !idCard || !password || !walletAddress) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // Check if ID card is already registered
    if (await isIdCardRegistered(idCard)) {
      return res.status(409).json({
        error: "ID already registered",
      });
    }

    // Create payment method
    const method: PaymentMethod = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      wallet,
      userId: generateUserId(),
      name,
      idCard,
      password,
      walletAddress,
      createdAt: new Date().toISOString(),
    };

    // Save to KV
    await savePaymentMethod(method);

    return res.json({
      success: true,
      message: "Payment method saved",
      method: {
        id: method.id,
        userId: method.userId,
        name: method.name,
        walletAddress: method.walletAddress,
        createdAt: method.createdAt,
      },
    });
  } catch (error) {
    console.error("[Fiat System] Error saving payment method:", error);
    return res.status(500).json({
      error: "Failed to save payment method",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Get payment methods for wallet
export const handleGetPaymentMethods: RequestHandler = async (req, res) => {
  try {
    const wallet = req.query.wallet as string;

    if (!wallet) {
      return res.status(400).json({
        error: "Missing wallet parameter",
      });
    }

    const methods = await getWalletPaymentMethods(wallet);
    const latestMethod = await getLatestPaymentMethod(wallet);

    return res.json({
      methods: methods.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        walletAddress: m.walletAddress,
        createdAt: m.createdAt,
        lastUsed: m.lastUsed,
      })),
      latestMethod: latestMethod
        ? {
            id: latestMethod.id,
            userId: latestMethod.userId,
            name: latestMethod.name,
            walletAddress: latestMethod.walletAddress,
            createdAt: latestMethod.createdAt,
            lastUsed: latestMethod.lastUsed,
          }
        : null,
    });
  } catch (error) {
    console.error("[Fiat System] Error getting payment methods:", error);
    return res.status(500).json({
      error: "Failed to get payment methods",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Delete payment method
export const handleDeletePaymentMethod: RequestHandler = async (req, res) => {
  try {
    const { wallet, methodId } = req.body;

    if (!wallet || !methodId) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const kv = getKVStorage();

    // Get the method to delete the ID card index
    const methodJson = await kv.get(`payment_method:${methodId}`);
    if (!methodJson) {
      return res.status(404).json({
        error: "Payment method not found",
      });
    }

    const method = JSON.parse(methodJson) as PaymentMethod;

    // Check if it belongs to the wallet
    if (method.wallet !== wallet) {
      return res.status(403).json({
        error: "Unauthorized",
      });
    }

    // Delete the method
    await kv.delete(`payment_method:${methodId}`);
    await kv.delete(`idcard:${method.idCard}`);

    // Remove from wallet's payment methods list
    const walletKey = `payment_methods:${wallet}`;
    const existingJson = await kv.get(walletKey);
    const methodIds = existingJson ? JSON.parse(existingJson) : [];
    const updatedIds = methodIds.filter((id: string) => id !== methodId);
    await kv.put(walletKey, JSON.stringify(updatedIds));

    return res.json({
      success: true,
      message: "Payment method deleted",
    });
  } catch (error) {
    console.error("[Fiat System] Error deleting payment method:", error);
    return res.status(500).json({
      error: "Failed to delete payment method",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
