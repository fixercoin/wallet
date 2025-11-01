import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check } from "lucide-react";
import QRCode from "react-qr-code";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";

interface ReceiveTransactionProps {
  onBack: () => void;
}

export const ReceiveTransaction: React.FC<ReceiveTransactionProps> = ({
  onBack,
}) => {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!wallet) return null;

  const handleCopyAddress = async () => {
    const success = await copyToClipboard(wallet.publicKey);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
    } else {
      toast({
        title: "Copy Failed",
        description:
          "Could not copy address. Please copy it manually from the input field.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="rounded-2xl border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] overflow-hidden">
          <div className="p-6 space-y-6 text-gray-900">
            <div className="flex items-center gap-3 -mt-4 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-sm">RECEIVE</div>
            </div>

            {/* QR Code */}
            <div className="text-center space-y-4">
              <div className="inline-block bg-white p-3 rounded-lg">
                <QRCode
                  value={wallet.publicKey}
                  size={160}
                  fgColor="#000000"
                  bgColor="#ffffff"
                  level="M"
                />
              </div>
              <p className="text-sm text-gray-600">Scan to send SOL</p>
            </div>

            {/* Address Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">Your Address</h3>
              <div className="flex gap-2">
                <Input
                  value={wallet.publicKey}
                  readOnly
                  className="font-mono text-sm bg-white text-gray-900 placeholder:text-gray-400"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="shrink-0 bg-white text-gray-900 hover:bg-gray-100"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
