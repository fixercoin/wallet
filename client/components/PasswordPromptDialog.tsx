import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { getWalletPassword } from "@/lib/wallet-password";

interface PasswordPromptDialogProps {
  isOpen: boolean;
  onUnlocked: () => void;
}

export const PasswordPromptDialog: React.FC<PasswordPromptDialogProps> = ({
  isOpen,
  onUnlocked,
}) => {
  const { unlockWithPassword } = useWallet();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUnlock = async () => {
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const success = await unlockWithPassword(password);
      if (success) {
        setPassword("");
        onUnlocked();
      } else {
        setError("Incorrect password");
      }
    } catch (err) {
      console.error("Unlock error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to unlock wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password) {
      e.preventDefault();
      handleUnlock();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-none border border-gray-700 w-full max-w-md mx-4 p-6 shadow-lg">
        <div className="space-y-6 uppercase">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">UNLOCK WALLET</h2>
            <p className="text-sm text-gray-300">
              Enter your password to access your wallet
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-300 font-semibold uppercase block mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="bg-gray-800 border border-gray-700 text-white rounded-none pr-10 placeholder:uppercase placeholder:text-gray-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-300/30 rounded-none flex gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <Button
              onClick={handleUnlock}
              disabled={!password || isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-none uppercase font-semibold disabled:opacity-50"
            >
              {isLoading ? "Unlocking..." : "Unlock"}
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Your password is required to access your wallet data.
          </p>
        </div>
      </div>
    </div>
  );
};
