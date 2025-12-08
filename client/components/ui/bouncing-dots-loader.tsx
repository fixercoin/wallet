import React from "react";

interface BouncingDotsLoaderProps {
  text?: string;
  dotColor?: string;
}

export const BouncingDotsLoader: React.FC<BouncingDotsLoaderProps> = ({
  text = "Importing wallet",
  dotColor = "#22c55e",
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateY(-10px);
            opacity: 0.7;
          }
        }
        .bouncing-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: ${dotColor};
          animation: bounce 1.4s ease-in-out infinite;
          margin: 0 4px;
        }
        .bouncing-dot:nth-child(1) { animation-delay: 0s; }
        .bouncing-dot:nth-child(2) { animation-delay: 0.2s; }
        .bouncing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div className="flex items-center justify-center">
        <div className="bouncing-dot"></div>
        <div className="bouncing-dot"></div>
        <div className="bouncing-dot"></div>
      </div>
      <p className="text-white text-sm font-medium">{text}...</p>
    </div>
  );
};
