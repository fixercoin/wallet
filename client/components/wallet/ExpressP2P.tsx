import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ExpressP2PProps {
  onBack?: () => void;
}

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  return (
    <div className="relative w-screen h-screen bg-white">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 rounded-full border border-[hsl(var(--border))] bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back to dashboard"
          className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
          Express P2P Service
        </span>
      </div>

      <iframe
        src="https://express.fixorium.com.pk"
        title="Express P2P"
        className="h-full w-full border-0"
        loading="lazy"
        allow="clipboard-write; fullscreen; payment *"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};
