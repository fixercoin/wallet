import React from "react";

export const PriceLoader: React.FC = () => {
  return (
    <div className="inline-flex items-center gap-1">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .price-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #4a5568;
          border-top-color: #999999;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>
      <div className="price-spinner"></div>
    </div>
  );
};
