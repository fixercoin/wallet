import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ExpressP2PProps {
  onBack: () => void;
}

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Express P2P Service</h1>
          </div>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-8 text-center">
          <p className="text-lg font-medium">Coming soon</p>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">
            We are building a fast and secure P2P experience.
          </p>
        </div>
      </div>
    </div>
  );
};
