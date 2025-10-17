import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React from "react";

export default function ExpressEmbed() {
  const navigate = useNavigate();
  const url = "https://express.fixorium.com.pk";

  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        src={url}
        title="Express P2P"
        className="w-full h-full"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        frameBorder={0}
      />
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="fixed top-3 left-3 z-10 h-10 px-3 rounded-full bg-white/90 border border-gray-200 shadow flex items-center gap-2 hover:bg-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Back</span>
      </button>
    </div>
  );
}
