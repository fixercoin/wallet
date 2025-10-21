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
          @keyframes pulse-glow {
            0%, 100% {
              filter: drop-shadow(0 0 8px rgba(255, 200, 70, 0.8)) drop-shadow(0 0 15px rgba(255, 200, 70, 0.5));
            }
            50% {
              filter: drop-shadow(0 0 12px rgba(255, 200, 70, 1)) drop-shadow(0 0 25px rgba(255, 200, 70, 0.7));
            }
          }

          @keyframes subtle-bounce {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-6px);
            }
          }

          .prize-box-gift {
            animation: pulse-glow 2.5s ease-in-out infinite, subtle-bounce 2.5s ease-in-out infinite;
          }
        `}
      </style>
      <div
        className="prize-box-gift inline-flex items-center justify-center cursor-pointer"
        onClick={onClick}
      >
        <Gift className="w-5 h-5 text-yellow-300" />
      </div>
    </>
  );
};
