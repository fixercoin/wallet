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
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            Receive
          </h1>
        </div>

        <div className="space-y-6">
          {/* QR Code (simple) */}
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-6">
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
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Scan to send SOL
              </p>
            </div>
          </div>

          {/* Address (simple) */}
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-4">
            <div className="mb-2">
              <h3 className="text-lg text-[hsl(var(--primary))]">
                Your Address
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={wallet.publicKey}
                  readOnly
                  className="font-mono text-sm bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="shrink-0 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/90"
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

          {/* Copy Button */}
          <Button
            onClick={handleCopyAddress}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Address
          </Button>
        </div>
      </div>
    </div>
  );
};
