import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TokenInfo } from "@/lib/wallet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2 } from "lucide-react";

interface TokenSelectionDialogProps {
  token: TokenInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onContinue: () => void;
  isDeleting?: boolean;
}

export const TokenSelectionDialog: React.FC<TokenSelectionDialogProps> = ({
  token,
  open,
  onOpenChange,
  onDelete,
  onContinue,
  isDeleting = false,
}) => {
  if (!token) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-[#1a2540] border-[#3a4550]">
        <DialogHeader>
          <DialogTitle className="text-white">Manage Token</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your token - view details or remove it from your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={token.logoURI} alt={token.symbol} />
            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-lg">
              {token.symbol.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">{token.symbol}</h3>
            <p className="text-sm text-gray-400">{token.name}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={onContinue}
            disabled={isDeleting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            View Details
          </Button>

          <Button
            onClick={onDelete}
            disabled={isDeleting}
            variant="destructive"
            className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Removing..." : "Remove Token"}
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-2">
          Removing a token will hide it from your wallet, but you can always add
          it back.
        </p>
      </DialogContent>
    </Dialog>
  );
};
