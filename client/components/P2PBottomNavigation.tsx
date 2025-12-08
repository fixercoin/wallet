import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface P2PBottomNavigationProps {
  onPaymentClick?: () => void;
  onCreateOfferClick?: () => void;
}

export const P2PBottomNavigation: React.FC<P2PBottomNavigationProps> = ({
  onPaymentClick,
  onCreateOfferClick,
}) => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 p-4 pb-8">
      <div className="max-w-7xl mx-auto flex justify-center items-center gap-4">
        <Button
          onClick={() => navigate("/buy-order")}
          className="px-6 py-3 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-xs uppercase"
        >
          BUY
        </Button>
        <Button
          onClick={() => navigate("/sell-order")}
          className="px-6 py-3 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-xs uppercase"
        >
          SELL
        </Button>
        <Button
          onClick={onPaymentClick}
          className="px-6 py-3 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-xs uppercase"
        >
          PAYMENT METHOD
        </Button>
      </div>
    </div>
  );
};
