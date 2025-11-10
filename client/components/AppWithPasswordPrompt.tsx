import React, { useEffect, useState, useRef } from "react";
import { useWallet } from "@/contexts/WalletContext";
import {
  doesWalletRequirePassword,
  clearWalletPassword,
} from "@/lib/wallet-password";
import { PasswordPromptDialog } from "./PasswordPromptDialog";

interface AppWithPasswordPromptProps {
  children: React.ReactNode;
}

export const AppWithPasswordPrompt: React.FC<AppWithPasswordPromptProps> = ({
  children,
}) => {
  const { needsPasswordUnlock, setNeedsPasswordUnlock } = useWallet();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const idleTimerRef = useRef<number | null>(null);
  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

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

  useEffect(() => {
    const requiresPassword = doesWalletRequirePassword();
    if (!requiresPassword) return;

    const resetTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        try {
          clearWalletPassword();
          setNeedsPasswordUnlock(true);
          setShowPasswordDialog(true);
        } catch (e) {}
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    const onActivity = () => resetTimer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") resetTimer();
    };

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [setNeedsPasswordUnlock]);

  const handlePasswordUnlocked = () => {
    setShowPasswordDialog(false);
    // reset inactivity timer on successful unlock
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
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
