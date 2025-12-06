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

export const P2PBottomNavigation: React.FC<P2PBottomNavigationProps> = ({
  onPaymentClick,
  onCreateOfferClick,
}) => {
  const navigate = useNavigate();
  const [showPostDialog, setShowPostDialog] = useState(false);

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
          onClick={onCreateOfferClick}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          POST
        </Button>
      </div>
    </div>
  );
};
