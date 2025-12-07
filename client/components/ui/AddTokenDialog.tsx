import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TokenInfo } from "@/lib/wallet";
import { PublicKey } from "@solana/web3.js";

interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenAdd: (token: TokenInfo) => void;
}

export const AddTokenDialog: React.FC<AddTokenDialogProps> = ({
  open,
  onOpenChange,
  onTokenAdd,
}) => {
  const [contractAddress, setContractAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const { toast } = useToast();

  const validateAndFetchToken = async () => {
    if (!contractAddress.trim()) {
      setError("Please enter a contract address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTokenInfo(null);

    try {
      // Validate the address format
      new PublicKey(contractAddress.trim());

      // For demonstration, we'll create a mock token info
      // In a real app, you would fetch this from the blockchain or a token metadata service
      const mockTokenInfo: TokenInfo = {
        mint: contractAddress.trim(),
        symbol: "UNKNOWN",
        name: "Unknown Token",
        decimals: 9,
        logoURI: "/placeholder.svg",
        balance: 0,
      };

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Special handling for FIXERCOIN
      if (
        contractAddress.trim() ===
        "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump"
      ) {
        mockTokenInfo.symbol = "FIXERCOIN";
        mockTokenInfo.name = "FIXERCOIN";
        mockTokenInfo.decimals = 6;
        mockTokenInfo.logoURI = "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png";
        mockTokenInfo.marketCap = 1200000; // $1.2M
        mockTokenInfo.volume24h = 456000; // $456K
        mockTokenInfo.liquidity = 234000; // $234K
      }

      // Special handling for LOCKER
      if (
        contractAddress.trim() ===
        "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump"
      ) {
        mockTokenInfo.symbol = "LOCKER";
        mockTokenInfo.name = "LOCKER";
        mockTokenInfo.decimals = 6;
        mockTokenInfo.logoURI =
          "https://cdn.builder.io/api/v1/image/assets%2F1dcb0d36c5bf4efdba0ee3bc71943ae3%2F36cba9baf32f4d82b64307dac9f5b70a?format=webp&width=800";
        mockTokenInfo.marketCap = 0;
        mockTokenInfo.volume24h = 0;
        mockTokenInfo.liquidity = 0;
      }

      // Special handling for FXM
      if (
        contractAddress.trim() ===
        "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump"
      ) {
        mockTokenInfo.symbol = "FXM";
        mockTokenInfo.name = "Fixorium";
        mockTokenInfo.decimals = 6;
        mockTokenInfo.logoURI =
          "https://cdn.builder.io/api/v1/image/assets%2Feff28b05195a4f5f8e8aaeec5f72bbfe%2Fc78ec8b33eec40be819bca514ed06f2a?format=webp&width=800";
        mockTokenInfo.marketCap = 0;
        mockTokenInfo.volume24h = 0;
        mockTokenInfo.liquidity = 0;
      }

      setTokenInfo(mockTokenInfo);
    } catch (error) {
      console.error("Token validation error:", error);
      setError("Invalid contract address format");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToken = () => {
    if (!tokenInfo) return;

    onTokenAdd(tokenInfo);
    toast({
      title: "Token Added",
      description: `${tokenInfo.symbol} has been added to your wallet`,
    });

    // Reset and close
    setContractAddress("");
    setTokenInfo(null);
    setError(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setContractAddress("");
    setTokenInfo(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Token</DialogTitle>
          <DialogDescription>
            Enter the contract address of the token you want to add to your
            wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract-address">Contract Address</Label>
            <Input
              id="contract-address"
              placeholder="Enter token contract address..."
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="font-mono text-sm bg-transparent border-[#FF7A5C]/30 text-white"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {tokenInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>
                    <strong>Token:</strong> {tokenInfo.name} ({tokenInfo.symbol}
                    )
                  </div>
                  <div>
                    <strong>Decimals:</strong> {tokenInfo.decimals}
                  </div>
                  <div>
                    <strong>Contract:</strong> {tokenInfo.mint.slice(0, 8)}...
                    {tokenInfo.mint.slice(-8)}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={validateAndFetchToken}
              disabled={!contractAddress.trim() || isLoading}
              className="flex-1"
            >
              {isLoading ? "Validating..." : "Validate Token"}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToken}
            disabled={!tokenInfo}
            className="bg-green-600 hover:bg-green-700"
          >
            Add Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
