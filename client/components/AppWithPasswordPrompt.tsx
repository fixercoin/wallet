import React, { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { doesWalletRequirePassword } from "@/lib/wallet-password";
import { PasswordPromptDialog } from "./PasswordPromptDialog";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const { needsPasswordUnlock } = useWallet();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkPasswordRequirement = async () => {
      try {
        const requiresPassword = await doesWalletRequirePassword();
        if (requiresPassword && needsPasswordUnlock) {
          setShowPasswordDialog(true);
        }
      } catch (error) {
        console.error("Error checking password requirement:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkPasswordRequirement();
  }, [needsPasswordUnlock]);

  const handlePasswordUnlocked = () => {
    setShowPasswordDialog(false);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-pulse text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PasswordPromptDialog
        isOpen={showPasswordDialog}
        onUnlocked={handlePasswordUnlocked}
      />
      {children}
    </>
  );
};
