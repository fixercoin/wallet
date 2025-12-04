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
      <div className="max-w-7xl mx-auto grid grid-cols-4 gap-3">
        <Button
          onClick={() => navigate("/p2p/buy-active-orders")}
          className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
        >
          BUY
        </Button>
        <Button
          onClick={() => navigate("/p2p/sell-active-orders")}
          className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
        >
          SELL
        </Button>
        <Button
          onClick={onPaymentClick}
          className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
        >
          PAYMENT
        </Button>
        <Button
          onClick={onCreateOfferClick}
          className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
        >
          +
        </Button>
      </div>
    </div>
  );
};
