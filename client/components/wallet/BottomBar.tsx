import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Bot } from "lucide-react";

interface BottomBarProps {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onAutoBot: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  onSend,
  onReceive,
  onSwap,
  onAutoBot,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-md mx-auto px-6 py-4">
        <div className="flex items-center justify-center">
          <div className="flex items-center bg-gray-100 rounded-full p-2 gap-1">
            {/* Send Button */}
            <Button
              onClick={onSend}
              className="w-12 h-12 rounded-full bg-white shadow-md hover:shadow-lg hover:bg-green-50 border-2 border-transparent hover:border-green-200 transition-all duration-200 p-0"
              variant="ghost"
            >
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </Button>

            {/* Receive Button */}
            <Button
              onClick={onReceive}
              className="w-12 h-12 rounded-full bg-white shadow-md hover:shadow-lg hover:bg-blue-50 border-2 border-transparent hover:border-blue-200 transition-all duration-200 p-0"
              variant="ghost"
            >
              <ArrowDownLeft className="h-5 w-5 text-blue-600" />
            </Button>

            {/* Swap Button */}
            <Button
              onClick={onSwap}
              className="w-12 h-12 rounded-full bg-white shadow-md hover:shadow-lg hover:bg-purple-50 border-2 border-transparent hover:border-purple-200 transition-all duration-200 p-0"
              variant="ghost"
            >
              <RefreshCw className="h-5 w-5 text-purple-600" />
            </Button>

            {/* Auto Bot Button */}
            <Button
              onClick={onAutoBot}
              className="w-12 h-12 rounded-full bg-white shadow-md hover:shadow-lg hover:bg-orange-50 border-2 border-transparent hover:border-orange-200 transition-all duration-200 p-0"
              variant="ghost"
            >
              <Bot className="h-5 w-5 text-orange-600" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
