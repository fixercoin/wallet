import React from "react";

export const PriceLoader: React.FC = () => {
  return (
    <div className="inline-flex items-center gap-1">
      <style>{`
        @keyframes bounce-dots {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          40% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
        .bounce-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          animation: bounce-dots 1.4s ease-in-out infinite;
        }
        .bounce-dot:nth-child(1) { animation-delay: 0s; }
        .bounce-dot:nth-child(2) { animation-delay: 0.2s; }
        .bounce-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div className="bounce-dot"></div>
      <div className="bounce-dot"></div>
      <div className="bounce-dot"></div>
    </div>
  );
};
