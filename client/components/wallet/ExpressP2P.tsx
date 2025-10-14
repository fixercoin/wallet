import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy } from "lucide-react";

type ExpressP2PProps = {
  onBack: () => void;
};

export function ExpressP2P({ onBack }: ExpressP2PProps) {
  const { wallet } = useWallet();
  const { toast } = useToast();

  const handleCopyAddress = async () => {
    if (!wallet) {
      return;
    }

    const success = await copyToClipboard(wallet.publicKey);
    toast({
      title: success ? "Address copied" : "Copy failed",
      description: success
        ? "Wallet address copied to clipboard"
        : "Please copy the address manually.",
      variant: success ? "default" : "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center justify-center gap-2 flex-1">
            <span className="font-mono text-sm">
              {wallet ? shortenAddress(wallet.publicKey, 6) : "No wallet"}
            </span>
            {wallet ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyAddress}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
                aria-label="Copy wallet address"
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="h-9 w-9" aria-hidden="true" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="wallet-card rounded-2xl p-6 flex flex-col items-center gap-6">
          <div
            className="express-p2p-loader"
            role="status"
            aria-label="Scanning for express P2P orders"
          >
            <div className="express-p2p-loader__inner" />
            <div className="express-p2p-loader__orbit">
              <span className="express-p2p-loader__dot" />
              <span className="express-p2p-loader__dot" />
              <span className="express-p2p-loader__dot" />
              <span className="express-p2p-loader__dot" />
            </div>
          </div>
          <p className="text-base font-semibold text-center express-detecting-text">
            detecting orders
          </p>
        </div>
      </div>
    </div>
  );
}

export default ExpressP2P;
