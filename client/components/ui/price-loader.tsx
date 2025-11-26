import React from "react";

export const PriceLoader: React.FC = () => {
  return (
    <div className="inline-flex items-center">
      <style>{`
        @keyframes pulse-breath {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        .price-pulse {
          display: inline-block;
          background: linear-gradient(90deg, #4a5568 0%, #6b7280 50%, #4a5568 100%);
          background-size: 200% 100%;
          animation: pulse-breath 2s ease-in-out infinite;
          height: 1em;
          width: 2.5em;
          border-radius: 3px;
        }
      `}</style>
      <div className="price-pulse"></div>
    </div>
  );
};
