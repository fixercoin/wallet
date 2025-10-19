import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Select() {
  const navigate = useNavigate();
  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 space-y-6 sm:space-y-8 flex flex-col items-center">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg aspect-square rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#FF7A5C]/30 via-[#FF5A8C]/20 to-[#FF7A5C]/10 border-2 border-[#FF7A5C]/50 backdrop-blur-2xl flex items-center justify-center shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-[#FF7A5C]/15 via-transparent to-transparent rounded-2xl sm:rounded-3xl" />
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-[#FF7A5C]/20 via-transparent to-transparent rounded-full blur-2xl animate-pulse group-hover:animate-none" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-[#FF5A8C]/20 via-transparent to-transparent rounded-full blur-2xl animate-pulse group-hover:animate-none" style={{ animationDelay: '1s' }} />

          <div className="text-center relative z-10 px-4">
            <div className="text-5xl sm:text-6xl md:text-7xl font-black mb-3 sm:mb-6 bg-gradient-to-r from-[#FF7A5C] via-[#FF5A8C] to-[#FF7A5C] bg-clip-text text-transparent drop-shadow-xl">
              P2P
            </div>
            <div className="text-lg sm:text-xl md:text-2xl font-semibold text-white/95 tracking-wide">Express Trading</div>
            <div className="mt-2 sm:mt-4 text-xs sm:text-sm text-white/60">Fast • Secure • Simple</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-sm sm:max-w-md md:max-w-lg">
          <Button
            onClick={() => navigate("/buy-now")}
            className="w-full aspect-square rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-2xl hover:scale-105 transition-all duration-300 text-white font-semibold text-2xl sm:text-3xl md:text-4xl shadow-lg active:scale-95 flex items-center justify-center"
          >
            buy
          </Button>

          <Button
            onClick={() => navigate("/sell-now")}
            className="w-full aspect-square rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-2xl hover:scale-105 transition-all duration-300 text-white font-semibold text-2xl sm:text-3xl md:text-4xl shadow-lg active:scale-95 flex items-center justify-center"
          >
            sell
          </Button>
        </div>
      </div>
    </div>
  );
}
