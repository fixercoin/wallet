import React, { useState } from "react";
import { Gift } from "lucide-react";

interface FlyingPrizeBoxProps {
  onClick?: () => void;
}

export const FlyingPrizeBox: React.FC<FlyingPrizeBoxProps> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <style>
        {`
          @keyframes floating {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(-20px) rotate(5deg);
            }
          }

          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(255, 122, 92, 0.6), 0 0 40px rgba(255, 90, 140, 0.4);
            }
            50% {
              box-shadow: 0 0 30px rgba(255, 122, 92, 0.8), 0 0 60px rgba(255, 90, 140, 0.6);
            }
          }

          @keyframes sparkle {
            0%, 100% {
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
          }

          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }

          .flying-prize-box {
            animation: floating 3s ease-in-out infinite;
          }

          .flying-prize-box.hovered {
            animation: floating 2s ease-in-out infinite;
          }

          .prize-box-container {
            animation: pulse-glow 2s ease-in-out infinite;
          }

          .sparkle-particle {
            animation: sparkle 1.5s ease-in-out infinite;
            position: absolute;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, #FFD700, #FF7A5C);
            border-radius: 50%;
          }
        `}
      </style>
      <div
        className="flying-prize-box"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        style={{
          cursor: onClick ? "pointer" : "default",
        }}
      >
        {/* Sparkle particles */}
        <div
          className="sparkle-particle"
          style={{
            left: "-30px",
            top: "10px",
            animationDelay: "0s",
          }}
        />
        <div
          className="sparkle-particle"
          style={{
            right: "-30px",
            top: "20px",
            animationDelay: "0.5s",
          }}
        />
        <div
          className="sparkle-particle"
          style={{
            left: "10px",
            top: "-20px",
            animationDelay: "1s",
          }}
        />
        <div
          className="sparkle-particle"
          style={{
            right: "10px",
            bottom: "-20px",
            animationDelay: "0.3s",
          }}
        />

        {/* Prize Box */}
        <div className="prize-box-container relative inline-block">
          <div
            className={`relative bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] rounded-2xl p-4 transition-all duration-300 ${
              isHovered ? "scale-110 shadow-2xl" : "shadow-xl"
            }`}
            style={{
              minWidth: "140px",
              textAlign: "center",
            }}
          >
            {/* Gift Icon */}
            <div className="flex justify-center mb-2">
              <Gift className="w-6 h-6 text-white drop-shadow-lg" />
            </div>

            {/* Text */}
            <div className="text-white font-bold text-sm uppercase tracking-wider">
              Earn
            </div>
            <div className="text-white font-extrabold text-lg uppercase tracking-widest drop-shadow-md">
              USDT
            </div>

            {/* Shimmer effect */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 transition-opacity"
              style={{
                background:
                  "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                animation: isHovered
                  ? "shimmer 2s infinite"
                  : "none",
              }}
            />
          </div>

          {/* Glow effect rings */}
          <div
            className="absolute inset-0 rounded-2xl opacity-50"
            style={{
              border: "2px solid rgba(255, 122, 92, 0.3)",
              transform: "scale(1.15)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </>
  );
};
