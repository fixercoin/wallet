import React, { createContext, useState, useCallback } from "react";
import type { PaymentMethod } from "@/lib/p2p-payment-methods";

export interface P2PSetupContextType {
  // P2P Setup state
  isP2PSetupComplete: boolean;
  setIsP2PSetupComplete: (complete: boolean) => void;

  // Payment method setup state
  currentPaymentMethod: PaymentMethod | null;
  setCurrentPaymentMethod: (method: PaymentMethod | null) => void;

  // Setup step tracking
  setupStep: "welcome" | "payment_method" | "confirm" | "complete";
  setSetupStep: (step: "welcome" | "payment_method" | "confirm" | "complete") => void;

  // Reset P2P setup state
  resetP2PSetup: () => void;
}

export const P2PSetupContext = createContext<P2PSetupContextType | null>(null);

export function P2PSetupProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isP2PSetupComplete, setIsP2PSetupComplete] = useState(false);
  const [currentPaymentMethod, setCurrentPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [setupStep, setSetupStep] = useState<
    "welcome" | "payment_method" | "confirm" | "complete"
  >("welcome");

  const resetP2PSetup = useCallback(() => {
    setIsP2PSetupComplete(false);
    setCurrentPaymentMethod(null);
    setSetupStep("welcome");
  }, []);

  const value: P2PSetupContextType = {
    isP2PSetupComplete,
    setIsP2PSetupComplete,
    currentPaymentMethod,
    setCurrentPaymentMethod,
    setupStep,
    setSetupStep,
    resetP2PSetup,
  };

  return (
    <P2PSetupContext.Provider value={value}>
      {children}
    </P2PSetupContext.Provider>
  );
}

export function useP2PSetup() {
  const context = React.useContext(P2PSetupContext);
  if (!context) {
    throw new Error("useP2PSetup must be used within P2PSetupProvider");
  }
  return context;
}
