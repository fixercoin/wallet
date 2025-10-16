import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React from "react";

export default function ExpressEmbed() {
  const navigate = useNavigate();
  const url = "https://express.fixorium.com.pk";

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 p-0 rounded-full border border-white/40 bg-white/80 backdrop-blur-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-sm font-medium">Express P2P Service</div>
          </div>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        <div className="rounded-xl overflow-hidden border border-[hsl(var(--border))] bg-white">
          <iframe
            src={url}
            title="Express P2P"
            className="w-full h-[70vh]"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            frameBorder={0}
          />
        </div>
      </div>
    </div>
  );
}
