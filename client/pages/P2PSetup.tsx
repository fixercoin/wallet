import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { getPaymentMethodsByWallet } from "@/lib/p2p-payment-methods";
import { CheckCircle2, ArrowRight } from "lucide-react";
import "../p2p.css";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export default function P2PSetup() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!wallet) {
      navigate("/");
      return;
    }

    // Check if user already has payment methods configured
    const checkPaymentMethods = async () => {
      try {
        const methods = await getPaymentMethodsByWallet(wallet.publicKey);
        setHasPaymentMethod(methods.length > 0);
      } catch (error) {
        console.error("Failed to check payment methods:", error);
        setHasPaymentMethod(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPaymentMethods();
  }, [wallet, navigate]);

  if (!wallet || isLoading) {
    return (
      <div className="express-p2p-page min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#22c55e] mx-auto mb-4" />
          <p className="text-gray-300">Loading setup...</p>
        </div>
      </div>
    );
  }

  const setupSteps: SetupStep[] = [
    {
      id: "wallet",
      title: "Wallet Connected",
      description: `Your wallet is ready: ${wallet.publicKey.slice(0, 8)}...${wallet.publicKey.slice(-8)}`,
      icon: <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />,
      completed: true,
    },
    {
      id: "payment",
      title: "Payment Method",
      description: "Add your preferred payment method for P2P transactions",
      icon: hasPaymentMethod ? (
        <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-gray-500 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-400">2</span>
        </div>
      ),
      completed: hasPaymentMethod,
    },
    {
      id: "ready",
      title: "Ready to Trade",
      description: "Start buying and selling crypto peer-to-peer",
      icon: hasPaymentMethod ? (
        <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-gray-500 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-400">3</span>
        </div>
      ),
      completed: hasPaymentMethod,
    },
  ];

  return (
    <div className="express-p2p-page min-h-screen bg-[#1f1f1f] text-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3">P2P Setup</h1>
          <p className="text-gray-400 text-lg">
            Get ready to start trading crypto peer-to-peer
          </p>
        </div>

        {/* Setup Steps */}
        <div className="space-y-6 mb-12">
          {setupSteps.map((step, index) => (
            <div
              key={step.id}
              className={`p-6 rounded-lg border-2 transition-all ${
                step.completed
                  ? "border-[#22c55e]/50 bg-[#22c55e]/10"
                  : "border-gray-700 bg-[#1a1a1a]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">{step.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
                {step.id === "payment" && !step.completed && (
                  <Button
                    onClick={() => setShowPaymentDialog(true)}
                    size="sm"
                    className="flex-shrink-0 bg-[#22c55e] hover:bg-[#16a34a] text-white"
                  >
                    Add
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Section */}
        <div className="space-y-4">
          {hasPaymentMethod ? (
            <Button
              onClick={() => navigate("/p2p")}
              className="w-full h-12 bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white font-semibold rounded-lg flex items-center justify-center gap-2"
            >
              Start Trading <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => setShowPaymentDialog(true)}
              className="w-full h-12 bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white font-semibold rounded-lg"
            >
              Add Payment Method
            </Button>
          )}

          <Button
            onClick={() => navigate("/p2p")}
            variant="ghost"
            className="w-full text-gray-300 hover:text-white hover:bg-gray-800"
          >
            Skip for now
          </Button>
        </div>
      </div>

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        walletAddress={wallet.publicKey}
        onSave={() => {
          setHasPaymentMethod(true);
          setShowPaymentDialog(false);
        }}
      />
    </div>
  );
}
