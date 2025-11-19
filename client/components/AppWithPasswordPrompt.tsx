import React, { useEffect, useState, useRef } from "react";
import { PasswordPromptDialog } from "./PasswordPromptDialog";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const { needsPasswordUnlock, setNeedsPasswordUnlock } = useWallet();
  const [showPasswordDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  // Password unlock dialog is disabled
  // The wallet will load without prompting for a password

  useEffect(() => {
    setIsChecking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const handlePasswordUnlocked = () => {
    // Dialog is disabled, this callback is not used
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
        isOpen={false}
        onUnlocked={handlePasswordUnlocked}
      />
      {children}
    </>
  );
};
