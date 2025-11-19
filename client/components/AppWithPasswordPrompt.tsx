import React, { useEffect, useState, useRef } from "react";
import { PasswordPromptDialog } from "./PasswordPromptDialog";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const idleTimerRef = useRef<number | null>(null);

  // Password unlock dialog is disabled
  // The wallet will load without prompting for a password

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const handlePasswordUnlocked = () => {
    // Dialog is disabled, this callback is not used
  };

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
