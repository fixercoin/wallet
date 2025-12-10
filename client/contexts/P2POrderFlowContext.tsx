import React, { createContext, useState, useCallback } from "react";
import type { P2POrder } from "@/lib/p2p-api";

export interface PaymentDetails {
  accountName: string;
  accountNumber: string;
}

export type DialogType =
  | "seller_payment_method"
  | "buyer_wallet_address"
  | "crypto_sent_confirmation"
  | "crypto_received_confirmation"
  | null;

export interface P2POrderFlowContextType {
  // Dialog management
  activeDialog: DialogType;
  setActiveDialog: (dialog: DialogType) => void;

  // Current order being processed
  currentOrder: P2POrder | null;
  setCurrentOrder: (order: P2POrder | null) => void;

  // Dialog state for different steps
  sellerPaymentDetails: PaymentDetails | null;
  setSellerPaymentDetails: (details: PaymentDetails | null) => void;

  buyerWalletAddress: string;
  setBuyerWalletAddress: (address: string) => void;

  // Order completion tracking
  sellerConfirmed: boolean;
  setSellerConfirmed: (confirmed: boolean) => void;

  buyerConfirmed: boolean;
  setBuyerConfirmed: (confirmed: boolean) => void;

  // Helper functions
  openSellerPaymentDialog: (order: P2POrder, details: PaymentDetails) => void;
  openBuyerWalletDialog: (order: P2POrder, buyerWallet: string) => void;
  openCryptoSentDialog: (order: P2POrder) => void;
  openCryptoReceivedDialog: (order: P2POrder) => void;
  resetFlow: () => void;
}

export const P2POrderFlowContext =
  createContext<P2POrderFlowContextType | null>(null);

export function P2POrderFlowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [currentOrder, setCurrentOrder] = useState<P2POrder | null>(null);
  const [sellerPaymentDetails, setSellerPaymentDetails] =
    useState<PaymentDetails | null>(null);
  const [buyerWalletAddress, setBuyerWalletAddress] = useState("");
  const [sellerConfirmed, setSellerConfirmed] = useState(false);
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);

  const openSellerPaymentDialog = useCallback(
    (order: P2POrder, details: PaymentDetails) => {
      setCurrentOrder(order);
      setSellerPaymentDetails(details);
      setActiveDialog("seller_payment_method");
    },
    [],
  );

  const openBuyerWalletDialog = useCallback(
    (order: P2POrder, buyerWallet: string) => {
      setCurrentOrder(order);
      setBuyerWalletAddress(buyerWallet);
      setActiveDialog("buyer_wallet_address");
    },
    [],
  );

  const openCryptoSentDialog = useCallback((order: P2POrder) => {
    setCurrentOrder(order);
    setActiveDialog("crypto_sent_confirmation");
  }, []);

  const openCryptoReceivedDialog = useCallback((order: P2POrder) => {
    setCurrentOrder(order);
    setActiveDialog("crypto_received_confirmation");
  }, []);

  const resetFlow = useCallback(() => {
    setActiveDialog(null);
    setCurrentOrder(null);
    setSellerPaymentDetails(null);
    setBuyerWalletAddress("");
    setSellerConfirmed(false);
    setBuyerConfirmed(false);
  }, []);

  const value: P2POrderFlowContextType = {
    activeDialog,
    setActiveDialog,
    currentOrder,
    setCurrentOrder,
    sellerPaymentDetails,
    setSellerPaymentDetails,
    buyerWalletAddress,
    setBuyerWalletAddress,
    sellerConfirmed,
    setSellerConfirmed,
    buyerConfirmed,
    setBuyerConfirmed,
    openSellerPaymentDialog,
    openBuyerWalletDialog,
    openCryptoSentDialog,
    openCryptoReceivedDialog,
    resetFlow,
  };

  return (
    <P2POrderFlowContext.Provider value={value}>
      {children}
    </P2POrderFlowContext.Provider>
  );
}

export function useP2POrderFlow() {
  const context = React.useContext(P2POrderFlowContext);
  if (!context) {
    throw new Error("useP2POrderFlow must be used within P2POrderFlowProvider");
  }
  return context;
}
