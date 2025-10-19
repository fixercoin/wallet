import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingDown } from "lucide-react";

export default function Select() {
  const navigate = useNavigate();
  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 relative z-20 space-y-8 flex flex-col items-center">
        <div className="w-[350px] h-[350px] rounded-2xl bg-gradient-to-br from-[#FF7A5C]/20 to-[#FF5A8C]/20 border border-[#FF7A5C]/30 backdrop-blur-xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] bg-clip-text text-transparent">
              P2P
            </div>
            <div className="text-lg text-white/80">Express Trading</div>
          </div>
        </div>

        <div className="flex gap-6">
          <Button
            onClick={() => navigate("/buy-now")}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:opacity-90 flex items-center justify-center shadow-lg"
          >
            <ShoppingCart size={24} />
          </Button>

          <Button
            onClick={() => navigate("/sell-now")}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:opacity-90 flex items-center justify-center shadow-lg"
          >
            <TrendingDown size={24} />
          </Button>
        </div>
      </div>
    </div>
  );
}
