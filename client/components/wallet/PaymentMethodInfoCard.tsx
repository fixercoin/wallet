import React from "react";
import { CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentMethodInfoCardProps {
  accountName: string;
  accountNumber: string;
  onEdit: () => void;
}

export const PaymentMethodInfoCard: React.FC<PaymentMethodInfoCardProps> = ({
  accountName,
  accountNumber,
  onEdit,
}) => {
  // Mask the account number, showing only last 4 digits
  const maskedAccountNumber =
    "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4);

  return (
    <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <CreditCard className="w-5 h-5 text-[#FF7A5C] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/70 uppercase mb-1">
              Payment Method
            </div>
            <div className="text-sm text-white/90 font-medium mb-1 break-words">
              {accountName}
            </div>
            <div className="text-xs text-white/60">
              Account: {maskedAccountNumber}
            </div>
          </div>
        </div>
        <Button
          onClick={onEdit}
          variant="ghost"
          size="sm"
          className="text-[#FF7A5C] hover:text-[#FF6B4D] hover:bg-[#FF7A5C]/10 flex-shrink-0"
        >
          Change
        </Button>
      </div>
    </div>
  );
};
