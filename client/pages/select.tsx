import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Select() {
  const navigate = useNavigate();
  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Back button pinned to viewport top-left */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 backdrop-blur-sm"
          aria-label="Go back to wallet dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 flex flex-col items-center">
        {/* Banner without any background color */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg aspect-square rounded-2xl sm:rounded-3xl relative overflow-hidden p-6 sm:p-8 flex flex-col items-center justify-center" />

        {/* Actions card under banner with only border color */}
        <div className="mt-6 w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl border-2 border-[#FF5A8C] p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
            <Button
              onClick={() => navigate("/buy-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              BUY
            </Button>

            <Button
              onClick={() => navigate("/sell-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              SELL
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
