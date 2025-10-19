import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Select() {
  const navigate = useNavigate();
  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-2xl mx-auto px-4 relative z-20 space-y-12 flex flex-col items-center">
        <div className="w-[400px] h-[400px] rounded-3xl bg-gradient-to-br from-[#FF7A5C]/25 to-[#FF5A8C]/25 border border-[#FF7A5C]/40 backdrop-blur-2xl flex items-center justify-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-[#FF7A5C]/10 via-transparent to-transparent rounded-3xl" />
          <div className="text-center relative z-10">
            <div className="text-7xl font-black mb-6 bg-gradient-to-r from-[#FF7A5C] via-[#FF5A8C] to-[#FF7A5C] bg-clip-text text-transparent drop-shadow-xl">
              P2P
            </div>
            <div className="text-2xl font-semibold text-white/90 tracking-wide">Express Trading</div>
            <div className="mt-4 text-sm text-white/60">Fast • Secure • Simple</div>
          </div>
        </div>

        <div className="flex gap-8 pt-4">
          <Button
            onClick={() => navigate("/buy-now")}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:shadow-2xl hover:scale-105 transition-all duration-300 text-white font-semibold text-lg shadow-lg"
          >
            buy
          </Button>

          <Button
            onClick={() => navigate("/sell-now")}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-[#FF5A8C] to-[#FF7A5C] hover:shadow-2xl hover:scale-105 transition-all duration-300 text-white font-semibold text-lg shadow-lg"
          >
            sell
          </Button>
        </div>
      </div>
    </div>
  );
}
