import React from "react";
import { Gift } from "lucide-react";

interface FlyingPrizeBoxProps {
  onClick?: () => void;
}

export const FlyingPrizeBox: React.FC<FlyingPrizeBoxProps> = ({ onClick }) => {
  return (
    <>
      <style>
        {`
          @keyframes flyLeftToRight {
            0% {
              transform: translateX(100vw) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              transform: translateX(-100vw) rotate(0deg);
              opacity: 0;
            }
          }

          @keyframes pulse-glow {
            0%, 100% {
              filter: drop-shadow(0 0 15px rgba(255, 122, 92, 0.6)) drop-shadow(0 0 30px rgba(255, 90, 140, 0.4));
            }
            50% {
              filter: drop-shadow(0 0 25px rgba(255, 122, 92, 0.8)) drop-shadow(0 0 50px rgba(255, 90, 140, 0.6));
            }
          }

          .flying-prize-box {
            animation: flyLeftToRight 15s linear infinite;
          }

          .prize-box-container {
            animation: pulse-glow 2s ease-in-out infinite;
          }
        `}
      </style>
      <div
        className="flying-prize-box fixed pointer-events-auto"
        onClick={onClick}
        style={{
          cursor: onClick ? "pointer" : "default",
          top: "30px",
          zIndex: 15,
        }}
      >
        <div className="prize-box-container inline-flex items-center justify-center">
          <Gift className="w-5 h-5 text-[#FF7A5C]" />
        </div>
      </div>
    </>
  );
};
