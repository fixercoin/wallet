import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PaymentMethod,
  savePaymentMethod,
  getPaymentMethod,
} from "@/lib/p2p-payment-methods";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  paymentMethodId?: string;
  onSave?: (method: PaymentMethod) => void;
}

export const PaymentMethodDialog: React.FC<PaymentMethodDialogProps> = ({
  open,
  onOpenChange,
  walletAddress,
  paymentMethodId,
  onSave,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EASYPAISA">("EASYPAISA");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [solanawWalletAddress, setSolanawWalletAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing payment method if editing
  useEffect(() => {
    const loadPaymentMethod = async () => {
      if (paymentMethodId && open) {
        const existing = await getPaymentMethod(paymentMethodId);
        if (existing) {
          setUserName(existing.userName);
          setPaymentMethod(existing.paymentMethod);
          setAccountName(existing.accountName);
          setAccountNumber(existing.accountNumber);
          setSolanawWalletAddress(existing.solanawWalletAddress);
        }
      } else if (open) {
        // Reset for new entry
        setUserName("");
        setPaymentMethod("EASYPAISA");
        setAccountName("");
        setAccountNumber("");
        setSolanawWalletAddress("");
        setErrors({});
      }
    };

    loadPaymentMethod();
  }, [paymentMethodId, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!userName.trim()) {
      newErrors.userName = "User name is required";
    }
    if (!accountName.trim()) {
      newErrors.accountName = "Account name is required";
    }
    if (!accountNumber.trim()) {
      newErrors.accountNumber = "Account number is required";
    }
    if (!solanawWalletAddress.trim()) {
      newErrors.solanawWalletAddress = "Solana wallet address is required";
    }

    // Basic validation for Solana wallet address (44 chars base58)
    if (solanawWalletAddress.trim() && solanawWalletAddress.length !== 44) {
      newErrors.solanawWalletAddress =
        "Invalid Solana wallet address (should be 44 characters)";
    }

    // Validate account number (should be numeric)
    if (accountNumber.trim() && !/^\d+$/.test(accountNumber.trim())) {
      newErrors.accountNumber = "Account number should contain only digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const savedMethod = savePaymentMethod(
        {
          walletAddress,
          userName: userName.trim(),
          paymentMethod,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          solanawWalletAddress: solanawWalletAddress.trim(),
        },
        paymentMethodId,
      );

      toast({
        title: "Success",
        description: "Payment method saved successfully",
      });

      onSave?.(savedMethod);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save payment method";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">
            {paymentMethodId ? "EDIT PAYMENT METHOD" : "ADD PAYMENT METHOD"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Name */}
          <div>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="ENTER YOUR NAME"
              disabled={loading}
              className={`uppercase ${errors.userName ? "border-red-500" : ""}`}
            />
            {errors.userName && (
              <p className="text-xs text-red-500 mt-1">{errors.userName}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as "EASYPAISA")}
              disabled={loading}
            >
              <SelectTrigger id="paymentMethod" className="uppercase">
                <SelectValue placeholder="SELECT PAYMENT METHOD" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EASYPAISA">EASYPAISA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account Name */}
          <div>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="ENTER ACCOUNT NAME"
              disabled={loading}
              className={`uppercase ${errors.accountName ? "border-red-500" : ""}`}
            />
          </div>

          {/* Account Number */}
          <div>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="ENTER ACCOUNT NUMBER"
              disabled={loading}
              className={errors.accountNumber ? "border-red-500" : ""}
            />
          </div>

          {/* Solana Wallet Address */}
          <div>
            <Input
              id="solanawWalletAddress"
              value={solanawWalletAddress}
              onChange={(e) => setSolanawWalletAddress(e.target.value)}
              placeholder="ENTER SOLANA WALLET ADDRESS"
              disabled={loading}
              className={`uppercase ${errors.solanawWalletAddress ? "border-red-500" : ""}`}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="uppercase"
          >
            CANCEL
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#22c55e] hover:bg-[#16a34a] uppercase"
          >
            {loading ? "SAVING..." : paymentMethodId ? "UPDATE" : "SAVE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
