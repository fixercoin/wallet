import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide-react";

interface PasswordSetupProps {
  isOpen: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  mode?: "create" | "unlock"; // create for new wallet, unlock for existing
}

export const PasswordSetup: React.FC<PasswordSetupProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  title = "Secure Your Wallet with a Password",
  description = "Create a strong password to encrypt your private keys. This password will protect your wallet from unauthorized access.",
  mode = "create",
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "create") {
      // Validate password strength
      if (password.length < 8) {
        setError("Password must be at least 8 characters long");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        setError(
          "Password must contain at least one uppercase letter and one number",
        );
        return;
      }
    } else {
      // unlock mode
      if (!password.trim()) {
        setError("Please enter your password");
        return;
      }
    }

    onConfirm(password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md mx-4 rounded-none bg-gray-900 border border-gray-700 p-6 shadow-lg">
        <div className="space-y-4 uppercase">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm text-gray-300">{description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                {mode === "create" ? "Create Password" : "Enter Password"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "create"
                      ? "Min 8 chars, 1 uppercase, 1 number"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10 bg-gray-800 border border-gray-700 text-white rounded-none placeholder:uppercase placeholder:text-gray-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === "create" && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-300">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10 bg-gray-800 border border-gray-700 text-white rounded-none placeholder:uppercase placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
                    disabled={isLoading}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <Alert className="bg-red-500/10 text-red-700 border-red-200">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {mode === "create" && (
              <div className="rounded-lg bg-transparent p-3">
                <p className="text-xs text-gray-300">
                  <strong>Security Note:</strong> Your password encrypts your
                  private keys. Without it, you cannot recover your wallet. Make
                  it strong and memorable!
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                variant="outline"
                className="flex-1 bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 uppercase rounded-[2px]"
              >
                {mode === "create" ? "Cancel" : "Close"}
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (!password.trim() && mode === "create")}
                className="flex-1 bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white font-semibold uppercase rounded-[2px]"
              >
                {isLoading
                  ? "Processing..."
                  : mode === "create"
                    ? "Secure Wallet"
                    : "Unlock"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
