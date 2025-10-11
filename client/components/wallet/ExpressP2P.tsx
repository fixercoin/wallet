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
    <div className="relative h-screen w-screen bg-white">
      <div className="absolute left-4 top-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back to dashboard"
          className="h-10 w-10 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm backdrop-blur-sm hover:bg-[hsl(var(--primary))]/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
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
