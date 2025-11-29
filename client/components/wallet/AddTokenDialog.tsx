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
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
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

      const mint = contractAddress.trim();

      // Try to fetch from DexScreener first for metadata and logo
      let dexToken: any = null;
      try {
        const response = await fetch(
          `/api/dexscreener/token?mint=${encodeURIComponent(mint)}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data?.pairs?.[0]) {
            dexToken = data.pairs[0];
          }
        }
      } catch {
        // DexScreener lookup failed, will use fallback
      }

      // Create token info with data from DexScreener or fallback
      const mockTokenInfo: TokenInfo = {
        mint,
        symbol: dexToken?.baseToken?.symbol || "UNKNOWN",
        name: dexToken?.baseToken?.name || "Unknown Token",
        decimals: 9,
        logoURI: dexToken?.info?.imageUrl || "/placeholder.svg",
        balance: 0,
      };

      // Special handling for known tokens
      if (mint === TOKEN_MINTS.FIXERCOIN) {
        mockTokenInfo.symbol = "FIXERCOIN";
        mockTokenInfo.name = "FIXERCOIN";
        mockTokenInfo.decimals = 6;
        mockTokenInfo.logoURI = "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png";
        mockTokenInfo.marketCap = 1200000;
        mockTokenInfo.volume24h = 456000;
        mockTokenInfo.liquidity = 234000;
      }

      if (mint === "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump") {
        mockTokenInfo.symbol = "LOCKER";
        mockTokenInfo.name = "LOCKER";
        mockTokenInfo.decimals = 6;
        mockTokenInfo.logoURI =
          "https://cdn.builder.io/api/v1/image/assets%2F1dcb0d36c5bf4efdba0ee3bc71943ae3%2F36cba9baf32f4d82b64307dac9f5b70a?format=webp&width=800";
        mockTokenInfo.marketCap = 0;
        mockTokenInfo.volume24h = 0;
        mockTokenInfo.liquidity = 0;
      }

      if (mint === "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump") {
        mockTokenInfo.symbol = "FXM";
        mockTokenInfo.name = "Fixorium";
        mockTokenInfo.decimals = 6;
        mockTokenInfo.logoURI =
          "https://cdn.builder.io/api/v1/image/assets%2Feff28b05195a4f5f8e8aaeec5f72bbfe%2Fc78ec8b33eec40be819bca514ed06f2a?format=webp&width=800";
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
      <DialogContent className="sm:max-w-md bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add Custom Token</DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter the contract address of the token you want to add to your
            wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract-address" className="text-gray-300">
              Contract Address
            </Label>
            <Input
              id="contract-address"
              placeholder="Enter token contract address..."
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="font-mono text-sm bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
            />
          </div>

          {error && (
            <Alert
              variant="destructive"
              className="bg-red-900/50 border-red-700"
            >
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {tokenInfo && (
            <Alert className="bg-green-900/50 border-green-700">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
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
              className="flex-1 rounded-[4px] bg-[#064e3b]/50 hover:bg-[#16a34a]/20 border border-[#22c55e]/30 text-white"
            >
              {isLoading ? "Validating..." : "Validate Token"}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="rounded-[4px] bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddToken}
            disabled={!tokenInfo}
            className="rounded-[4px] bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#1ea853] hover:to-[#15803d] text-white"
          >
            Add Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
