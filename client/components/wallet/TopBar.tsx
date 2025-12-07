import React from "react";
import { Button } from "@/components/ui/button";
import {
  Flame,
  Menu,
  Wallet,
  Gift,
  Flame as BurnIcon,
  Lock,
  Coins,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  onAccounts?: () => void;
  onAirdrop: () => void;
  onBurn: () => void;
  onLock: () => void;
  onSettings: () => void;
  onQuestOpen?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onAccounts,
  onAirdrop,
  onBurn,
  onLock,
  onSettings,
  onQuestOpen,
}) => {
  const navigate = useNavigate();

  return (
    <div className="bg-transparent px-4 py-3 mb-2">
      {/* Pill bar replicating the provided design */}
      <div className="flex items-center gap-2 rounded-xl bg-transparent text-white h-10 px-0 shadow-none ring-0">
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500">
            <Flame className="h-4 w-4 text-white" />
          </span>
          <span className="truncate text-xs opacity-90">fixorium</span>
        </div>
        <button
          aria-label="Prize"
          className="p-1.5 rounded-lg hover:bg-white/5"
          onClick={onQuestOpen}
        >
          <Gift className="h-4 w-4 text-white/80" />
        </button>
        <Button
          size="sm"
          className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-white ring-0 focus-visible:ring-0 border border-transparent"
          aria-hidden
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default TopBar;
