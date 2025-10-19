import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Select() {
  const navigate = useNavigate();
  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 py-8 relative z-20 space-y-4">
        <h1 className="text-xl font-bold text-center">Express P2P Service</h1>
        <p className="text-center text-white/80">Choose advertiser and action</p>

        <Card className="bg-transparent backdrop-blur-xl">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/70">Advertiser</div>
                <div className="text-lg font-semibold">FIXORIUM</div>
              </div>
              <div className="text-right text-sm text-white/70">
                <div>Available order: <span className="text-white">Unlimited</span></div>
                <div>Payment: <span className="text-white">Easypaisa</span></div>
              </div>
            </div>
            <div className="text-sm text-white/70">Asset: <span className="text-white">Select on next step</span></div>
            <Button onClick={() => navigate("/buy-now")} className="w-full h-11 rounded-lg font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C]">Buy</Button>
          </CardContent>
        </Card>

        <Card className="bg-transparent backdrop-blur-xl">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/70">Advertiser</div>
                <div className="text-lg font-semibold">fixorium</div>
              </div>
              <div className="text-right text-sm text-white/70">
                <div>Available order: <span className="text-white">Unlimited</span></div>
                <div>Payment: <span className="text-white">Easypaisa</span></div>
              </div>
            </div>
            <div className="text-sm text-white/70">Asset: <span className="text-white">Select on next step</span></div>
            <Button onClick={() => navigate("/sell-now")} variant="secondary" className="w-full h-11 rounded-lg font-semibold bg-[#1a2540]/50 border border-[#FF7A5C]/30 hover:bg-[#1a2540]/70">Sell</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
