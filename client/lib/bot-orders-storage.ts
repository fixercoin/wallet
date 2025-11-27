export type TokenType = "FIXERCOIN" | "SOL";

export interface BotOrder {
  id: string;
  type: "buy" | "sell";
  token: TokenType;
  tokenMint: string;
  buyPrice: number;
  targetSellPrice: number;
  actualSellPrice?: number;
  timestamp: number;
  status: "pending" | "completed" | "failed";
  solAmount: number;
  tokenAmount?: number;
  signature?: string;
  error?: string;
  feeDeducted: boolean;
  feeSignature?: string;
  outputToken?: "SOL" | "USDC";
  outputAmount?: number;
}

export interface BotSession {
  id: string;
  token: TokenType;
  tokenMint: string;
  numberOfMakers: number;
  orderAmount: number;
  createdAt: number;
  status: "running" | "paused" | "stopped";
  buyOrders: BotOrder[];
  sellOrders: BotOrder[];
  priceSpread: number;
}

const SESSIONS_KEY = "bot_sessions";
const CURRENT_SESSION_KEY = "bot_current_session";

export const botOrdersStorage = {
  createSession: (
    token: TokenType,
    tokenMint: string,
    numberOfMakers: number,
    orderAmount: number,
    priceSpread: number,
  ): BotSession => {
    const session: BotSession = {
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      token,
      tokenMint,
      numberOfMakers,
      orderAmount,
      priceSpread,
      createdAt: Date.now(),
      status: "running",
      buyOrders: [],
      sellOrders: [],
    };
    return session;
  },

  saveSession: (session: BotSession): void => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const index = sessions.findIndex((s) => s.id === session.id);
      if (index >= 0) {
        sessions[index] = session;
      } else {
        sessions.push(session);
      }
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      localStorage.setItem(CURRENT_SESSION_KEY, session.id);
    } catch (error) {
      console.error("Error saving session:", error);
    }
  },

  getCurrentSession: (): BotSession | null => {
    try {
      const sessionId = localStorage.getItem(CURRENT_SESSION_KEY);
      if (!sessionId) return null;
      const sessions = botOrdersStorage.getAllSessions();
      return sessions.find((s) => s.id === sessionId) || null;
    } catch (error) {
      console.error("Error getting current session:", error);
      return null;
    }
  },

  getAllSessions: (): BotSession[] => {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting sessions:", error);
      return [];
    }
  },

  addBuyOrder: (
    sessionId: string,
    buyPrice: number,
    solAmount: number,
  ): BotOrder | null => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return null;

      const buyOrder: BotOrder = {
        id: `order_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: "buy",
        token: session.token,
        tokenMint: session.tokenMint,
        buyPrice,
        targetSellPrice:
          session.token === "FIXERCOIN" ? buyPrice + 0.00002 : buyPrice + 2,
        timestamp: Date.now(),
        status: "pending",
        solAmount,
        feeDeducted: false,
      };

      session.buyOrders.push(buyOrder);
      botOrdersStorage.saveSession(session);
      return buyOrder;
    } catch (error) {
      console.error("Error adding buy order:", error);
      return null;
    }
  },

  completeBuyOrder: (
    sessionId: string,
    orderId: string,
    tokenAmount: number,
    signature?: string,
  ): boolean => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return false;

      const order = session.buyOrders.find((o) => o.id === orderId);
      if (!order) return false;

      order.status = "completed";
      order.tokenAmount = tokenAmount;
      order.signature = signature;
      botOrdersStorage.saveSession(session);
      return true;
    } catch (error) {
      console.error("Error completing buy order:", error);
      return false;
    }
  },

  addSellOrder: (
    sessionId: string,
    buyOrderId: string,
    sellPrice: number,
    tokenAmount: number,
    signature?: string,
    outputToken: "SOL" | "USDC" = "SOL",
  ): BotOrder | null => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return null;

      let buyPrice = sellPrice; // Default to current sell price
      let targetSellPrice = sellPrice; // For standalone sell orders

      // If buyOrderId is provided and valid, use buy order's prices
      if (buyOrderId) {
        const buyOrder = session.buyOrders.find((o) => o.id === buyOrderId);
        if (buyOrder) {
          buyPrice = buyOrder.buyPrice;
          targetSellPrice = buyOrder.targetSellPrice;
        }
      }

      const sellOrder: BotOrder = {
        id: `sell_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: "sell",
        token: session.token,
        tokenMint: session.tokenMint,
        buyPrice,
        targetSellPrice,
        actualSellPrice: sellPrice,
        timestamp: Date.now(),
        status: "pending",
        solAmount: 0,
        tokenAmount,
        signature,
        feeDeducted: false,
        outputToken,
        outputAmount: 0,
      };

      session.sellOrders.push(sellOrder);
      botOrdersStorage.saveSession(session);
      return sellOrder;
    } catch (error) {
      console.error("Error adding sell order:", error);
      return null;
    }
  },

  completeSellOrder: (
    sessionId: string,
    orderId: string,
    outputAmount: number,
    signature?: string,
  ): boolean => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return false;

      const order = session.sellOrders.find((o) => o.id === orderId);
      if (!order) return false;

      order.status = "completed";
      order.outputAmount = outputAmount;
      const tokenName = order.outputToken === "USDC" ? "USDC" : "SOL";
      console.log(
        `[BotOrdersStorage] Completed SELL order: ${outputAmount} ${tokenName}`,
      );
      order.signature = signature;
      botOrdersStorage.saveSession(session);
      return true;
    } catch (error) {
      console.error("Error completing sell order:", error);
      return false;
    }
  },

  markFeeDeducted: (
    sessionId: string,
    orderId: string,
    feeSignature: string,
  ): boolean => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return false;

      const order =
        session.buyOrders.find((o) => o.id === orderId) ||
        session.sellOrders.find((o) => o.id === orderId);

      if (!order) return false;

      order.feeDeducted = true;
      order.feeSignature = feeSignature;
      botOrdersStorage.saveSession(session);
      return true;
    } catch (error) {
      console.error("Error marking fee deducted:", error);
      return false;
    }
  },

  deleteSession: (sessionId: string): void => {
    try {
      const sessions = botOrdersStorage.getAllSessions();
      const filtered = sessions.filter((s) => s.id !== sessionId);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
      const current = localStorage.getItem(CURRENT_SESSION_KEY);
      if (current === sessionId) {
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  },
};
