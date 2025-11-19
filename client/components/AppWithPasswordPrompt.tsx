import React, { useEffect, useRef } from "react";
import { PasswordPromptDialog } from "./PasswordPromptDialog";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  return (
    <>
      <PasswordPromptDialog isOpen={false} onUnlocked={() => {}} />
      {children}
    </>
  );
};
