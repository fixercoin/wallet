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
              filter: drop-shadow(0 0 15px rgba(255, 122, 92, 0.6)) drop-shadow(0 0 30px rgba(255, 90, 140, 0.4));
            }
            50% {
              filter: drop-shadow(0 0 25px rgba(255, 122, 92, 0.8)) drop-shadow(0 0 50px rgba(255, 90, 140, 0.6));
            }
          }

          @keyframes subtle-bounce {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-8px);
            }
          }

          .prize-box-container {
            animation: pulse-glow 2.5s ease-in-out infinite, subtle-bounce 2.5s ease-in-out infinite;
          }
        `}
      </style>
      <div
        className="flex flex-col items-center justify-center gap-3 cursor-pointer"
        onClick={onClick}
      >
        <div className="prize-box-container inline-flex items-center justify-center">
          <Gift className="w-8 h-8 text-[#FF7A5C]" />
        </div>
        <div className="text-center">
          <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Earn Reward
          </div>
          <div className="text-sm font-extrabold text-[#FF7A5C] uppercase tracking-widest">
            WIN USDT
          </div>
        </div>
      </div>
    </>
  );
};
