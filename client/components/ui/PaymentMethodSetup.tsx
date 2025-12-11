import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import {
  savePaymentMethod,
  PaymentMethodData,
  PaymentMethod,
} from "@/lib/payment-utils";
import { toast } from "sonner";

interface PaymentMethodSetupProps {
  wallet: string;
  onMethodSaved?: (method: PaymentMethod) => void;
}

export function PaymentMethodSetup({
  wallet,
  onMethodSaved,
}: PaymentMethodSetupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedMethod, setSavedMethod] = useState<PaymentMethod | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState<PaymentMethodData>({
    name: "",
    idCard: "",
    password: "",
    walletAddress: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveMethod = async () => {
    if (!formData.name || !formData.idCard || !formData.password || !formData.walletAddress) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const method = await savePaymentMethod(wallet, formData);
      setSavedMethod(method);
      onMethodSaved?.(method);
      toast.success("Payment method saved successfully!");

      setFormData({
        name: "",
        idCard: "",
        password: "",
        walletAddress: "",
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to save payment method";
      if (errorMsg.includes("ID already registered")) {
        toast.error("ID already registered");
      } else {
        toast.error(errorMsg);
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (savedMethod) {
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-br from-green-600/20 to-emerald-700/10 border-green-500/20 rounded-2xl shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-12 h-12 bg-green-500/30 rounded-full flex items-center justify-center border border-green-500/30">
                <Check className="h-6 w-6 text-green-400" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-center text-green-100 mb-6 uppercase">
              PAYMENT METHOD SAVED
            </h3>

            <div className="space-y-3 bg-gray-800/50 rounded-xl p-4 border border-gray-700/30 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                    YOUR UNIQUE ID
                  </p>
                  <p className="text-2xl font-bold text-green-300 font-mono">
                    {savedMethod.userId}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(savedMethod.userId, "userId")
                  }
                  className={
                    copiedField === "userId"
                      ? "border-green-500/50 text-green-300"
                      : ""
                  }
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copiedField === "userId" ? "Copied!" : "Copy"}
                </Button>
              </div>

              <div className="pt-3 border-t border-gray-700/30 space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-400 font-semibold">Method:</span> {savedMethod.name}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-400 font-semibold">Wallet:</span>{" "}
                  {savedMethod.walletAddress.substring(0, 10)}...
                  {savedMethod.walletAddress.substring(-10)}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              Use this ID to receive fiat and crypto transfers
            </p>

            <Button
              onClick={() => setSavedMethod(null)}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 rounded-lg uppercase"
            >
              Add Another Method
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-purple-600/20 to-pink-700/10 border-purple-500/20 rounded-2xl shadow-xl">
        <CardContent className="pt-6">
          <h3 className="text-xl font-bold text-purple-100 mb-6 uppercase">
            SETUP PAYMENT METHOD
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
                Payment Method Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Easypaisa Account"
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-lg text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
                ID Card / Phone Number
              </label>
              <input
                type="text"
                name="idCard"
                value={formData.idCard}
                onChange={handleInputChange}
                placeholder="Your ID or phone number"
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-lg text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
                Password / PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Secure password"
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-lg text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
                Wallet Address (for Crypto)
              </label>
              <input
                type="text"
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleInputChange}
                placeholder="Your Solana wallet address"
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-lg text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <Button
              onClick={handleSaveMethod}
              disabled={
                loading ||
                !formData.name ||
                !formData.idCard ||
                !formData.password ||
                !formData.walletAddress
              }
              className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 transition-all duration-300 mt-2 uppercase"
            >
              {loading ? "Saving..." : "Save Payment Method"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
