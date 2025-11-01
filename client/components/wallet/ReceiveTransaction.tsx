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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d1b47]/95 to-[#1f0f3d]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-[#a855f7]/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center font-medium text-sm">RECEIVE</div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="bg-transparent p-6 space-y-6 text-white">
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
            <p className="text-sm text-gray-300">Scan to send SOL</p>
          </div>

          {/* Address Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">Your Address</h3>
            <div className="flex gap-2">
              <Input
                value={wallet.publicKey}
                readOnly
                className="font-mono text-sm bg-[#2d1b47]/50 text-white placeholder:text-gray-300"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
                className="shrink-0 bg-[#2d1b47]/50 text-white hover:bg-[#a855f7]/10"
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
  );
};
