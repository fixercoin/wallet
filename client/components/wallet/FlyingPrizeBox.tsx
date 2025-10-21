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
          @keyframes floatingLarge {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(-15px) rotate(3deg);
            }
          }

          @keyframes pulse-glow-large {
            0%, 100% {
              box-shadow: 0 0 30px rgba(255, 122, 92, 0.7), 0 0 60px rgba(255, 90, 140, 0.5);
            }
            50% {
              box-shadow: 0 0 50px rgba(255, 122, 92, 0.9), 0 0 100px rgba(255, 90, 140, 0.7);
            }
          }

          @keyframes sparkle-large {
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
            animation: floatingLarge 3.5s ease-in-out infinite;
          }

          .flying-prize-box.hovered {
            animation: floatingLarge 2.5s ease-in-out infinite;
          }

          .prize-box-container {
            animation: pulse-glow-large 2.5s ease-in-out infinite;
          }

          .sparkle-particle {
            animation: sparkle-large 1.5s ease-in-out infinite;
            position: absolute;
            width: 6px;
            height: 6px;
            background: radial-gradient(circle, #FFD700, #FF7A5C);
            border-radius: 50%;
          }

          .prize-box-wrapper {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        `}
      </style>
      <div className="prize-box-wrapper">
        <div
          className="flying-prize-box"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={onClick}
          style={{
            cursor: onClick ? "pointer" : "default",
            position: "relative",
          }}
        >
          {/* Sparkle particles */}
          <div
            className="sparkle-particle"
            style={{
              left: "-50px",
              top: "15px",
              animationDelay: "0s",
            }}
          />
          <div
            className="sparkle-particle"
            style={{
              right: "-50px",
              top: "30px",
              animationDelay: "0.5s",
            }}
          />
          <div
            className="sparkle-particle"
            style={{
              left: "20px",
              top: "-30px",
              animationDelay: "1s",
            }}
          />
          <div
            className="sparkle-particle"
            style={{
              right: "20px",
              bottom: "-30px",
              animationDelay: "0.3s",
            }}
          />

          {/* Prize Box */}
          <div className="prize-box-container relative inline-block">
            <div
              className={`relative bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] rounded-3xl p-6 transition-all duration-300 ${
                isHovered ? "scale-110 shadow-2xl" : "shadow-2xl"
              }`}
              style={{
                minWidth: "180px",
                textAlign: "center",
              }}
            >
              {/* Gift Icon */}
              <div className="flex justify-center mb-3">
                <Gift className="w-10 h-10 text-white drop-shadow-lg" />
              </div>

              {/* Text */}
              <div className="text-white font-bold text-base uppercase tracking-wider">
                Earn
              </div>
              <div className="text-white font-extrabold text-2xl uppercase tracking-widest drop-shadow-md">
                USDT
              </div>

              {/* Shimmer effect */}
              <div
                className="absolute inset-0 rounded-3xl opacity-0 transition-opacity"
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
              className="absolute inset-0 rounded-3xl opacity-50"
              style={{
                border: "3px solid rgba(255, 122, 92, 0.3)",
                transform: "scale(1.2)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
