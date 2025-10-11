import React from "react";

interface ExpressP2PProps {
  onBack?: () => void;
}

export const ExpressP2P: React.FC<ExpressP2PProps> = () => {
  return (
    <div className="w-screen h-screen bg-white">
      <iframe
        src="https://express.fixorium.com.pk"
        title="Express P2P"
        className="w-full h-full"
        loading="lazy"
        allow="clipboard-write; fullscreen; payment *"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};
