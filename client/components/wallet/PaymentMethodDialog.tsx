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
  getPaymentMethodsByWallet,
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
  const [isEditing, setIsEditing] = useState(false);
  const [savedMethodId, setSavedMethodId] = useState<string | undefined>();
  const [userName, setUserName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EASYPAISA">("EASYPAISA");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [solanawWalletAddress, setSolanawWalletAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing payment method if editing or if one exists for the wallet
  useEffect(() => {
    const loadPaymentMethod = async () => {
      if (!open) return;

      try {
        if (paymentMethodId) {
          // Loading a specific payment method for editing
          const existing = await getPaymentMethod(paymentMethodId);
          if (existing) {
            setSavedMethodId(existing.id);
            setUserName(existing.userName);
            setPaymentMethod(existing.paymentMethod);
            setAccountName(existing.accountName);
            setAccountNumber(existing.accountNumber);
            setSolanawWalletAddress(existing.solanawWalletAddress);
            setIsEditing(false);
          }
        } else {
          // Check if there's already a saved payment method for this wallet
          const existingMethods =
            await getPaymentMethodsByWallet(walletAddress);
          if (existingMethods.length > 0) {
            const existing = existingMethods[0]; // Use the first/latest method
            setSavedMethodId(existing.id);
            setUserName(existing.userName);
            setPaymentMethod(existing.paymentMethod);
            setAccountName(existing.accountName);
            setAccountNumber(existing.accountNumber);
            setSolanawWalletAddress(existing.solanawWalletAddress);
            setIsEditing(false);
          } else {
            // No saved method, show blank form for new entry
            setSavedMethodId(undefined);
            setUserName("");
            setPaymentMethod("EASYPAISA");
            setAccountName("");
            setAccountNumber("");
            setSolanawWalletAddress("");
            setIsEditing(true);
            setErrors({});
          }
        }
      } catch (error) {
        console.error("Error loading payment method:", error);
        // If there's an error, default to edit mode with blank form
        setSavedMethodId(undefined);
        setUserName("");
        setPaymentMethod("EASYPAISA");
        setAccountName("");
        setAccountNumber("");
        setSolanawWalletAddress("");
        setIsEditing(true);
      }
    };

    loadPaymentMethod();
  }, [paymentMethodId, open, walletAddress]);

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
      const savedMethod = await savePaymentMethod(
        {
          walletAddress,
          userName: userName.trim(),
          paymentMethod,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          solanawWalletAddress: solanawWalletAddress.trim(),
        },
        savedMethodId || paymentMethodId,
      );

      toast({
        title: "Success",
        description: "Payment method saved successfully",
        duration: 3000,
      });

      setSavedMethodId(savedMethod.id);
      setIsEditing(false);
      onSave?.(savedMethod);
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

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (isEditing && !savedMethodId) {
      // If editing a new unsaved method, close the dialog
      onOpenChange(false);
    } else if (isEditing && savedMethodId) {
      // If editing an existing saved method, go back to view mode
      setIsEditing(false);
    } else {
      // If in view mode, close the dialog
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md bg-[#1a2540] border border-gray-600/50 shadow-lg">
        <DialogHeader>
          <DialogTitle className="uppercase text-white">
            {isEditing
              ? savedMethodId
                ? "EDIT PAYMENT METHOD"
                : "ADD PAYMENT METHOD"
              : "PAYMENT METHOD"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isEditing && savedMethodId ? (
            // View mode - show saved information with "Payment method is added" message
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                <p className="text-sm font-semibold text-green-400 uppercase">
                  ✓ Payment Method Added
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#0f1729] border border-gray-600">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                  Name
                </p>
                <p className="text-white font-medium">{userName}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0f1729] border border-gray-600">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                  Payment Method
                </p>
                <p className="text-white font-medium">{paymentMethod}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0f1729] border border-gray-600">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                  Account Name
                </p>
                <p className="text-white font-medium">{accountName}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0f1729] border border-gray-600">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                  Account Number
                </p>
                <p className="text-white font-medium">{accountNumber}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0f1729] border border-gray-600">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                  Solana Wallet Address
                </p>
                <p className="text-white font-medium break-all text-xs">
                  {solanawWalletAddress}
                </p>
              </div>
            </div>
          ) : (
            // Edit mode - show form
            <>
              {/* User Name */}
              <div>
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="ENTER YOUR NAME"
                  disabled={loading}
                  className={`uppercase bg-[#0f1729] border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 ${errors.userName ? "border-red-500" : ""}`}
                />
                {errors.userName && (
                  <p className="text-xs text-red-500 mt-1">{errors.userName}</p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setPaymentMethod(value as "EASYPAISA")
                  }
                  disabled={loading}
                >
                  <SelectTrigger
                    id="paymentMethod"
                    className="uppercase bg-[#0f1729] border border-gray-600 text-white"
                  >
                    <SelectValue placeholder="SELECT PAYMENT METHOD" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2540] border border-gray-600">
                    <SelectItem value="EASYPAISA" className="text-white">
                      EASYPAISA
                    </SelectItem>
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
                  className={`uppercase bg-[#0f1729] border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 ${errors.accountName ? "border-red-500" : ""}`}
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
                  className={`bg-[#0f1729] border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 ${errors.accountNumber ? "border-red-500" : ""}`}
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
                  className={`uppercase bg-[#0f1729] border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 ${errors.solanawWalletAddress ? "border-red-500" : ""}`}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="uppercase bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
          >
            {isEditing ? "CANCEL" : "CLOSE"}
          </Button>
          {!isEditing && savedMethodId ? (
            <Button
              onClick={handleEditClick}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white uppercase disabled:bg-blue-800"
            >
              EDIT
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-white uppercase disabled:bg-green-700"
            >
              {loading ? "SAVING..." : "SAVE"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
