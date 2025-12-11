import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check, QrCode } from "lucide-react";
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

  const QRCodePlaceholder = () => (
    <div className="w-48 h-48 mx-auto bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-lg flex items-center justify-center">
      <div className="text-center text-gray-300">
        <QrCode className="h-12 w-12 mx-auto mb-2" />
        <p className="text-sm">QR Code</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Receive</h1>
        </div>

        <div className="space-y-6">
          {/* QR Code Card */}
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <QRCodePlaceholder />
                <p className="text-sm text-gray-300">Scan to send SOL</p>
              </div>
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">Your Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={wallet.publicKey}
                  readOnly
                  className="font-mono text-sm bg-transparent border-white/30 text-white"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="shrink-0 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

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
