import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Plus, Coins, ChevronDown } from "lucide-react";
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
    <div className="min-h-screen bg-white text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-wide">
            <span className="text-cream">FIXORIUM</span>
            <span className="text-gray-400 text-xs">/ add</span>
          </div>
          <Button
            variant="ghost"
            className="h-8 px-3 text-cream hover:bg-[#38bdf8]/20"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </div>
      </div>

      <div className="w-full px-4 py-6 space-y-4">
        <Card className="bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-lg">Choose an action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <Button className="w-full h-12 bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#022c3d] font-semibold border-0 flex items-center justify-between">
                  <span className="flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Create
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
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

            <Button
              className="w-full h-12 bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#022c3d] font-semibold border-0"
              onClick={() => navigate("/fixorium/token-listing")}
            >
              <Coins className="h-4 w-4 mr-2" /> Token Listing
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
