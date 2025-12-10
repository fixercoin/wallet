import React from "react";
import { Info, CheckCircle } from "lucide-react";
import {
  generateTransferInstructions,
  validateTransferConfiguration,
} from "@/lib/p2p-transfer";
import type { CreatedOrder } from "@/lib/p2p-order-creation";

interface P2PTransferInstructionsProps {
  order: CreatedOrder;
  variant?: "card" | "inline" | "modal";
}

export const P2PTransferInstructions: React.FC<
  P2PTransferInstructionsProps
> = ({ order, variant = "card" }) => {
  const validation = validateTransferConfiguration(order);
  const instructions = generateTransferInstructions(order);

  if (!validation.valid) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">
          <strong>⚠️ Transfer Configuration Error:</strong> {validation.error}
        </p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="space-y-2">
        {instructions.map((instruction, idx) => (
          <div key={idx} className="flex gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">{instruction}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex gap-2 mb-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <h3 className="font-semibold text-blue-900">
          {order.type === "BUY"
            ? "How to Complete Your Buy Order"
            : "How to Complete Your Sell Order"}
        </h3>
      </div>

      <div className="space-y-2 ml-7">
        {instructions.map((instruction, idx) => (
          <div key={idx} className="text-sm text-blue-800">
            {instruction}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
        <p className="text-xs text-blue-900">
          <strong>🔒 Security:</strong> All transfers go through the official
          system accounts to ensure secure handling and dispute resolution.
        </p>
      </div>
    </div>
  );
};
