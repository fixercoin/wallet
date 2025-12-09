import React from "react";

export const PriceLoader: React.FC<{ size?: "sm" | "md" | "lg" }> = ({
  size = "sm",
}) => {
  const sizeMap = {
    sm: "4px",
    md: "6px",
    lg: "8px",
  };

  const dotSize = sizeMap[size];
  const gapSize = size === "sm" ? "3px" : size === "md" ? "4px" : "6px";

  return (
    <div className="inline-flex items-center" style={{ gap: gapSize }}>
      <style>{`
        @keyframes price-loader-blink {
          0%, 100% {
            opacity: 0.4;
            transform: translateY(0px);
          }
          50% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }
        .price-loader-dot {
          display: inline-block;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          animation: price-loader-blink 1.4s ease-in-out infinite;
        }
        .price-loader-dot:nth-child(1) { animation-delay: 0s; }
        .price-loader-dot:nth-child(2) { animation-delay: 0.2s; }
        .price-loader-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div
        className="price-loader-dot"
        style={{ width: dotSize, height: dotSize }}
      ></div>
      <div
        className="price-loader-dot"
        style={{ width: dotSize, height: dotSize }}
      ></div>
      <div
        className="price-loader-dot"
        style={{ width: dotSize, height: dotSize }}
      ></div>
    </div>
  );
};
