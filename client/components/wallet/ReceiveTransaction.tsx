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
        title: "ADDRESS COPIED",
        description: "WALLET ADDRESS COPIED TO CLIPBOARD",
      });
    } else {
      toast({
        title: "COPY FAILED",
        description:
          "COULD NOT COPY ADDRESS. PLEASE COPY IT MANUALLY FROM THE INPUT FIELD.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden flex flex-col items-center">
      <div className="w-full relative z-20">
        <div className="border-0 bg-transparent">
          <div className="p-6 space-y-6 text-gray-900">
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
              <p className="text-sm text-gray-600">
                SCAN TO GET DEPOSIT ADDRESS
              </p>
            </div>

            {/* Address Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">
                YOUR ADDRESS
              </h3>
              <div className="flex gap-2">
                <Input
                  value={wallet.publicKey.toUpperCase()}
                  readOnly
                  className="font-mono text-sm bg-transparent text-gray-900 placeholder:text-gray-400 border border-gray-300/30 rounded-lg uppercase"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="shrink-0 bg-transparent text-gray-900 hover:bg-transparent border-0 rounded-md"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Green Back Button */}
            <Button
              onClick={onBack}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
