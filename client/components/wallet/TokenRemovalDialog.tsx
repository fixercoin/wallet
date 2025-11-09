import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";

interface TokenRemovalDialogProps {
  open: boolean;
  token: TokenInfo | null;
  onOpenChange: (open: boolean) => void;
  onRemove: () => Promise<void> | void;
  onContinue: () => void;
  isRemoving?: boolean;
}

export const TokenRemovalDialog: React.FC<TokenRemovalDialogProps> = ({
  open,
  token,
  onOpenChange,
  onRemove,
  onContinue,
  isRemoving = false,
}) => {
  if (!token) return null;

  const handleRemove = async () => {
    const result = onRemove();
    if (result instanceof Promise) {
      await result;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Manage Token
          </DialogTitle>
          <DialogDescription>
            What would you like to do with {token.symbol}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
            {token.logoURI && (
              <img
                src={token.logoURI}
                alt={token.symbol}
                className="h-8 w-8 rounded-full"
              />
            )}
            <div>
              <p className="font-semibold text-sm text-foreground">
                {token.symbol}
              </p>
              <p className="text-xs text-muted-foreground">{token.name}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={onContinue}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isRemoving}
            >
              Continue
            </Button>
            <Button
              onClick={handleRemove}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove Token"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
