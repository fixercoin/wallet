import React from "react";

export interface OrderCardProps {
  title?: string;
  imageUrl?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function OrderCard({
  title = "Buy",
  imageUrl = "https://cdn.builder.io/api/v1/image/assets%2Fb5a8e7e2eb7e43a19f3227053e3cfaeb%2Ff096d75efa5346eca92c8e28c02f3406?format=webp&width=800",
  onClick,
  children,
}: OrderCardProps) {
  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <img src={imageUrl} alt="p2p" className="w-full h-36 object-cover" />
      <div className="p-4 space-y-3">
        {children}
        <button
          onClick={onClick}
          className="w-full h-11 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-semibold transition-colors"
        >
          Buy With PKR
        </button>
      </div>
    </div>
  );
}
