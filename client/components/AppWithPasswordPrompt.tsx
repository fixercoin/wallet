import React, { useEffect, useState, useRef } from "react";
import { PasswordPromptDialog } from "./PasswordPromptDialog";
import { useWallet } from "@/contexts/WalletContext";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const { needsPasswordUnlock, setNeedsPasswordUnlock } = useWallet();
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const handlePasswordUnlocked = () => {
    setNeedsPasswordUnlock(false);
  };

  return (
    <>
      <PasswordPromptDialog
        isOpen={needsPasswordUnlock}
        onUnlocked={handlePasswordUnlocked}
      />
      {children}
    </>
  );
};
