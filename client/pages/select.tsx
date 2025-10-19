import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Select() {
  const navigate = useNavigate();
  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 flex flex-col items-center">
        <div className="absolute top-6 left-6 z-30">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 backdrop-blur-sm"
            aria-label="Go back to wallet dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>

        <div
          className="w-full max-w-sm sm:max-w-md md:max-w-lg aspect-square rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden group p-6 sm:p-8 flex flex-col items-center justify-between"
          style={{
            backgroundImage:
              "url('https://cdn.builder.io/api/v1/image/assets%2Fd0658813d4084fba91e188ce3fc9ac4f%2Ff98a0c38026744178f6ea91c30482956?format=webp&width=800')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent rounded-2xl sm:rounded-3xl" />

          <div className="flex-1" />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full relative z-10">
            <Button
              onClick={() => navigate("/buy-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              buy
            </Button>

            <Button
              onClick={() => navigate("/sell-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              sell
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
