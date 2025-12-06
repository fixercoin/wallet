import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShoppingCart, TrendingUp } from "lucide-react";

interface P2PBottomNavigationProps {
  onPaymentClick?: () => void;
  onCreateOfferClick?: () => void;
}

const SERVERS = [
  { id: 1, name: "Server 1", password: "123" },
  { id: 2, name: "Server 2", password: "123" },
  { id: 3, name: "Server 3", password: "123" },
  { id: 4, name: "Server 4", password: "123" },
  { id: 5, name: "Server 5", password: "123" },
];

export const P2PBottomNavigation: React.FC<P2PBottomNavigationProps> = ({
  onPaymentClick,
  onCreateOfferClick,
}) => {
  const navigate = useNavigate();
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 p-4 pb-8">
      <div className="max-w-7xl mx-auto flex justify-center items-center gap-4">
        <Button
          onClick={() => navigate("/buy-order")}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          BUY
        </Button>
        <Button
          onClick={() => navigate("/sell-order")}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          SELL
        </Button>
        <Button
          onClick={onPaymentClick}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          ADD
        </Button>
        <Button
          onClick={() => setShowPostDialog(true)}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          POST
        </Button>
      </div>

      {/* Post Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              CREATE POST
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase">
              SELECT WHETHER YOU WANT TO BUY OR SELL CRYPTO
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => {
                setShowPostDialog(false);
                navigate("/buy-crypto");
              }}
              className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 text-white font-semibold rounded-lg transition-all uppercase"
            >
              <ShoppingCart className="w-8 h-8" />
              <span>BUY CRYPTO</span>
            </Button>
            <Button
              onClick={() => {
                setShowPostDialog(false);
                navigate("/sell-now");
              }}
              className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600/20 to-green-600/10 border border-green-500/30 hover:border-green-500/50 text-white font-semibold rounded-lg transition-all uppercase"
            >
              <TrendingUp className="w-8 h-8" />
              <span>SELL CRYPTO</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
