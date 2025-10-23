import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Flame,
  Menu,
  Search,
  Wallet,
  Gift,
  Flame as BurnIcon,
  Lock,
  Settings,
  FileText,
  Coins,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  onAccounts?: () => void;
  onAirdrop: () => void;
  onBurn: () => void;
  onLock: () => void;
  onSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onAccounts,
  onAirdrop,
  onBurn,
  onLock,
  onSettings,
}) => {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-10 bg-transparent border-b border-white/5">
      <div className="max-w-md mx-auto px-3 py-3">
        {/* Pill bar replicating the provided design */}
        <div className="flex items-center gap-2 rounded-xl bg-[#141c2b] text-white h-10 px-3 shadow-sm ring-1 ring-white/10">
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500">
              <Flame className="h-4 w-4 text-white" />
            </span>
            <span className="truncate text-xs opacity-90">fixorium</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-white ring-0 focus-visible:ring-0 border border-white/10"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={() => onAccounts?.()} className="flex items-center gap-2 text-xs">
                <Wallet className="h-4 w-4" />
                <span>Accounts</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAirdrop} className="flex items-center gap-2 text-xs">
                <Gift className="h-4 w-4" />
                <span>Airdrop</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onLock} className="flex items-center gap-2 text-xs">
                <Lock className="h-4 w-4" />
                <span>Lock SPL</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSettings} className="flex items-center gap-2 text-xs">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-white ring-0 focus-visible:ring-0 border border-white/10"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onAccounts?.()}
                className="flex items-center gap-2 text-xs"
              >
                <Wallet className="h-4 w-4" />
                <span>MY-WALLET</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onAirdrop}
                className="flex items-center gap-2 text-xs"
              >
                <Gift className="h-4 w-4" />
                <span>C-BUILDER</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onBurn}
                className="flex items-center gap-2 text-xs"
              >
                <BurnIcon className="h-4 w-4" />
                <span>SPL-BURN</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate("/fixorium/spl-meta")}
                className="flex items-center gap-2 text-xs"
              >
                <FileText className="h-4 w-4" />
                <span>SPL-META</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onLock}
                className="flex items-center gap-2 text-xs"
              >
                <Lock className="h-4 w-4" />
                <span>LOCK-SPL</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate("/fixorium/create-token")}
                className="flex items-center gap-2 text-xs"
              >
                <FileText className="h-4 w-4" />
                <span>MINT-SPL</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate("/express")}
                className="flex items-center gap-2 text-xs"
              >
                <Coins className="h-4 w-4" />
                <span>P2P</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  window.dispatchEvent(new CustomEvent("openRewardsQuest"))
                }
                className="flex items-center gap-2 text-xs"
              >
                <Gift className="h-4 w-4" />
                <span>REWARDS</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onSettings}
                className="flex items-center gap-2 text-xs"
              >
                <Settings className="h-4 w-4" />
                <span>SETTINGS</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
