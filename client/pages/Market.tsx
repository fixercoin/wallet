import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Market() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white">
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-4 md:px-6 lg:px-8 py-4 relative z-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            BACK
          </Button>
          <h1 className="text-2xl font-bold text-white uppercase">
            MARKET PLACE
          </h1>
          <div className="w-10" />
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] rounded-lg p-6 border border-[#22c55e]/40 relative overflow-hidden">
          <div className="relative z-10">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-[#22c55e] to-[#16a34a] p-4 rounded-full">
                <ShoppingCart className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Title and Description */}
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-2 uppercase">
              MARKET PLACE
            </h2>
            <p className="text-gray-700 text-center text-sm mb-6 uppercase">
              BROWSE AND TRADE CRYPTO ASSETS ON SOLANA NETWORK
            </p>

            {/* Info Cards */}
            <div className="space-y-3 mb-6">
              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-[#22c55e]/30">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase">
                  WHAT IS MARKET PLACE?
                </h3>
                <p className="text-xs text-gray-700 uppercase">
                  YOUR GATEWAY TO BUY AND SELL CRYPTO ASSETS. ACCESS THOUSANDS
                  OF TOKENS WITH SECURE TRANSACTIONS ON SOLANA.
                </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-[#22c55e]/30">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase">
                  WHY USE MARKET PLACE?
                </h3>
                <p className="text-xs text-gray-700 uppercase">
                  INSTANT TRADING, COMPETITIVE PRICES, AND SECURE TRANSACTIONS
                  FOR ALL YOUR CRYPTO NEEDS.
                </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-[#22c55e]/30">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase">
                  LOW FEES
                </h3>
                <p className="text-xs text-gray-700 uppercase">
                  TRADE WITH MINIMAL TRANSACTION FEES AND FAST CONFIRMATION
                  TIMES ON THE SOLANA BLOCKCHAIN.
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              onClick={() => {
                // This is a placeholder action - can be connected to marketplace
                console.log("Initiating marketplace flow");
              }}
              className="w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-bold py-3 rounded-lg transition-all duration-200 uppercase"
            >
              BROWSE MARKET PLACE
            </Button>

            {/* Footer Info */}
            <p className="text-xs text-gray-700 text-center mt-4 uppercase">
              SECURE AND VERIFIED TRANSACTIONS. 100% SAFE TO USE.
            </p>
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="mt-6 bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700/30">
          <h3 className="text-sm font-bold text-white mb-3 uppercase">
            HOW IT WORKS
          </h3>
          <div className="space-y-2 text-xs text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-[#22c55e] font-bold mt-0.5">1</span>
              <span className="uppercase">BROWSE AVAILABLE CRYPTO ASSETS</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#22c55e] font-bold mt-0.5">2</span>
              <span className="uppercase">SELECT YOUR PREFERRED TOKEN</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#22c55e] font-bold mt-0.5">3</span>
              <span className="uppercase">
                ENTER AMOUNT AND COMPLETE TRANSACTION
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#22c55e] font-bold mt-0.5">4</span>
              <span className="uppercase">
                RECEIVE CRYPTO IN YOUR WALLET INSTANTLY
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
