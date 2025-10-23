import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Plus, Coins, ChevronDown, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function FixoriumAdd() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white px-0 py-4 sm:px-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-none sm:max-w-md mx-auto relative z-10 px-0 sm:px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-[#FF7A5C]/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-white">FIXORIUM</h1>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-[#FF7A5C]/10 transition-colors"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleNavigate("/fixorium/create-token")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigate("/fixorium/create-pool")}>
                <Coins className="h-4 w-4 mr-2" />
                Create Pool
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavigate("/fixorium/my-tokens")}>
                <Coins className="h-4 w-4 mr-2" />
                My Tokens
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigate("/fixorium/token-listing")}>
                <Coins className="h-4 w-4 mr-2" />
                Listed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card */}
        <div className="bg-transparent border-0 rounded-none sm:rounded-2xl overflow-hidden text-white">
          <div className="p-5 space-y-4">
            <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Choose an action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full h-12 rounded-lg font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white border-0 shadow-lg flex items-center justify-center"
                  onClick={() => handleNavigate("/fixorium/create-token")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Token
                </Button>

                <Button
                  className="w-full h-12 rounded-lg font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white border-0 shadow-lg flex items-center justify-center"
                  onClick={() => handleNavigate("/fixorium/create-pool")}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Create Pool
                </Button>

                <Button
                  className="w-full h-12 rounded-lg font-semibold bg-[#1a2540]/50 text-white/70 border border-[#FF7A5C]/30 hover:bg-[#1a2540]/70 hover:text-white"
                  onClick={() => handleNavigate("/fixorium/my-tokens")}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  My Tokens
                </Button>

                <Button
                  className="w-full h-12 rounded-lg font-semibold bg-[#1a2540]/50 text-white/70 border border-[#FF7A5C]/30 hover:bg-[#1a2540]/70 hover:text-white"
                  onClick={() => handleNavigate("/fixorium/token-listing")}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Listed
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
