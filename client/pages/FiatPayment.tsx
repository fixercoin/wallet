import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { PaymentMethodSetup } from "@/components/ui/PaymentMethodSetup";
import { getPaymentMethods, PaymentMethod } from "@/lib/payment-utils";

export default function FiatPayment() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPaymentMethod = async () => {
      if (wallet) {
        try {
          const { latestMethod } = await getPaymentMethods(wallet);
          setPaymentMethod(latestMethod);
        } catch (error) {
          console.error("Error fetching payment method:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadPaymentMethod();
  }, [wallet]);

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-gray-300 mb-4">
              Please connect your wallet to use the fiat system
            </p>
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white">
      <div className="w-full max-w-lg mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            onClick={() => navigate("/fiat")}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            BACK
          </Button>
        </div>

        {/* Payment Method Section */}
        <div className="mt-6 animate-in fade-in duration-300">
          <div className="space-y-4">
            {paymentMethod ? (
              <>
                <Card className="bg-gradient-to-br from-green-600/20 to-emerald-700/10 border-green-500/20 rounded-2xl shadow-xl">
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <p className="text-green-300 text-sm font-bold uppercase mb-2">
                        Active Payment Method
                      </p>
                      <h3 className="text-3xl font-bold text-white font-mono">
                        {paymentMethod.userId}
                      </h3>
                    </div>

                    <div className="bg-gray-800/50 rounded-xl p-4 space-y-3 border border-gray-700/30">
                      <div className="text-left">
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                          METHOD
                        </p>
                        <p className="text-white font-semibold">
                          {paymentMethod.name}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                          WALLET
                        </p>
                        <p className="text-white font-mono text-sm break-all">
                          {paymentMethod.walletAddress}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center mt-4">
                      Use this ID to receive fiat and crypto transfers
                    </p>

                    <Button
                      onClick={() => setPaymentMethod(null)}
                      className="w-full mt-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2 rounded-lg uppercase"
                    >
                      Add New Method
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <PaymentMethodSetup
                wallet={wallet}
                onMethodSaved={(method) => {
                  setPaymentMethod(method);
                  toast.success("Payment method created successfully!");
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
