import React, { useEffect, useRef } from "react";
import { PasswordPromptDialog } from "./PasswordPromptDialog";
import { useWallet } from "@/contexts/WalletContext";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const { requiresPassword } = useWallet();
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  return (
    <>
      <PasswordPromptDialog isOpen={requiresPassword} onUnlocked={() => {}} />
      {children}
    </>
  );
};
