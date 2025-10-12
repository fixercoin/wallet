import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Copy,
  LogOut,
  Trash2,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import bs58 from "bs58";

interface SettingsProps {
  onBack: () => void;
  onOpenSetup?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, onOpenSetup }) => {
  const { wallet, wallets, logout, selectWallet } = useWallet();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<"recovery" | "private">(
    "recovery",
  );
  const [secretAction, setSecretAction] = useState<"hidden" | "show" | "copy">(
    "hidden",
  );

  if (wallets.length === 0) {
    return (
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-6">
            <div className="p-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))]">
                No accounts available. Create a wallet from the dashboard using
                the + button.
              </p>
              <div className="mt-4">
                <Button
                  onClick={onBack}
                  className="w-full bg-transparent border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const privateKeyBase58 = useMemo(() => {
    try {
      return wallet?.secretKey ? bs58.encode(wallet.secretKey) : "";
    } catch {
      return "";
    }
  }, [wallet?.secretKey]);

  const handleCopyAddress = async () => {
    if (!wallet) return;
    const success = await copyToClipboard(wallet.publicKey);
    if (success) {
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
    } else {
      toast({
        title: "Copy Failed",
        description: "Could not copy address. Please copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleShowRecoveryPhrase = () => {
    if (wallet?.mnemonic) {
      setRecoveryPhrase(wallet.mnemonic);
      setShowRecoveryPhrase(true);
    } else {
      toast({
        title: "Recovery Phrase Unavailable",
        description: "Recovery phrase is not available for this wallet",
        variant: "destructive",
      });
    }
  };

  const handleCopyRecoveryPhrase = async () => {
    if (recoveryPhrase) {
      const success = await copyToClipboard(recoveryPhrase);
      if (success) {
        toast({
          title: "Recovery Phrase Copied",
          description: "Recovery phrase copied to clipboard",
        });
      } else {
        toast({
          title: "Copy Failed",
          description:
            "Could not copy recovery phrase. Please copy it manually.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCopyPrivateKey = async () => {
    if (!privateKeyBase58) return;
    const success = await copyToClipboard(privateKeyBase58);
    if (success) {
      toast({
        title: "Private Key Copied",
        description: "Private key copied to clipboard",
      });
    } else {
      toast({
        title: "Copy Failed",
        description: "Could not copy private key.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    onBack();
  };

  const handleDeleteAccount = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    logout();
    toast({
      title: "Account Deleted",
      description: "Your wallet has been permanently deleted",
      variant: "destructive",
    });
    onBack();
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            ACCOUNTS
          </h1>
        </div>

        <div>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-6">
            <div className="px-6 pt-2">
              <div className="text-[hsl(var(--primary))] font-semibold">
            
              </div>
            </div>
            <div className="space-y-6">
              <section>
                <div className="mb-2 text-[hsl(var(--foreground))] font-medium">
                  All ACCOUNTS
                </div>
                <div className="flex items-center">
                  <select
                    value={wallet?.publicKey || ""}
                    onChange={(e) => {
                      const pk = e.target.value;
                      selectWallet(pk);
                      const sel = wallets.find((x) => x.publicKey === pk);
                      setRecoveryPhrase(sel?.mnemonic || "");
                      setShowRecoveryPhrase(!!sel?.mnemonic);
                      setShowPrivateKey(!!sel?.secretKey);
                      toast({
                        title: "Account Selected",
                        description: "Switched to selected account",
                      });
                    }}
                    className="flex-1 bg-[hsl(var(--input))] text-[hsl(var(--foreground))] p-2 rounded-md border border-[hsl(var(--border))] font-mono"
                  >
                    {wallets.map((w) => (
                      <option
                        key={w.publicKey}
                        value={w.publicKey}
                        className="text-black"
                      >
                        {shortenAddress(w.publicKey, 6)}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <div className="border-t border-[hsl(var(--border))]" />

              <div className="border-t border-[hsl(var(--border))]" />

              <section>
                <div className="mb-3 flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <Key className="h-5 w-5" />
                  <span className="font-medium">SECRETS</span>
                </div>
                <div className="space-y-2">
                  <div className="p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg">
                    <div className="flex gap-3 mb-3">
                      <select
                        aria-label="Select secret"
                        value={selectedSecret}
                        onChange={(e) =>
                          setSelectedSecret(
                            e.target.value as "recovery" | "private",
                          )
                        }
                        className="flex-1 bg-[hsl(var(--input))] text-[hsl(var(--foreground))] p-2 rounded-md border border-[hsl(var(--border))] font-mono"
                      >
                        <option value="recovery">Recovery Phrase</option>
                        <option value="private">Private Key</option>
                      </select>

                      <select
                        aria-label="Secret action"
                        value={secretAction}
                        onChange={async (e) => {
                          const v = e.target.value as
                            | "hidden"
                            | "show"
                            | "copy";
                          setSecretAction(v);
                          if (v === "show") {
                            if (selectedSecret === "recovery") {
                              if (wallet?.mnemonic) {
                                setRecoveryPhrase(wallet.mnemonic);
                                setShowRecoveryPhrase(true);
                                setShowPrivateKey(false);
                              } else {
                                toast({
                                  title: "Unavailable",
                                  description:
                                    "Recovery phrase not available for this account",
                                  variant: "destructive",
                                });
                                setSecretAction("hidden");
                              }
                            } else {
                              if (privateKeyBase58) {
                                setShowPrivateKey(true);
                                setShowRecoveryPhrase(false);
                              } else {
                                toast({
                                  title: "Unavailable",
                                  description: "Private key not available",
                                  variant: "destructive",
                                });
                                setSecretAction("hidden");
                              }
                            }
                          } else if (v === "copy") {
                            if (selectedSecret === "recovery") {
                              if (wallet?.mnemonic) {
                                const ok = await copyToClipboard(
                                  wallet.mnemonic,
                                );
                                if (ok)
                                  toast({
                                    title: "Copied",
                                    description: "Recovery phrase copied",
                                  });
                                else
                                  toast({
                                    title: "Copy Failed",
                                    description:
                                      "Could not copy recovery phrase",
                                    variant: "destructive",
                                  });
                              } else {
                                toast({
                                  title: "Unavailable",
                                  description: "Recovery phrase not available",
                                  variant: "destructive",
                                });
                              }
                            } else {
                              if (privateKeyBase58) {
                                const ok =
                                  await copyToClipboard(privateKeyBase58);
                                if (ok)
                                  toast({
                                    title: "Copied",
                                    description: "Private key copied",
                                  });
                                else
                                  toast({
                                    title: "Copy Failed",
                                    description: "Could not copy private key",
                                    variant: "destructive",
                                  });
                              } else {
                                toast({
                                  title: "Unavailable",
                                  description: "Private key not available",
                                  variant: "destructive",
                                });
                              }
                            }
                            setSecretAction("hidden");
                            setShowPrivateKey(false);
                            setShowRecoveryPhrase(false);
                          } else {
                            setShowPrivateKey(false);
                            setShowRecoveryPhrase(false);
                          }
                        }}
                        className="bg-[hsl(var(--input))] text-[hsl(var(--foreground))] p-1 rounded-md border border-[hsl(var(--border))]"
                      >
                        <option value="hidden">Hidden</option>
                        <option value="show">Show</option>
                        <option value="copy">Copy</option>
                      </select>
                    </div>

                    <Textarea
                      value={
                        showRecoveryPhrase
                          ? recoveryPhrase
                          : showPrivateKey
                            ? privateKeyBase58
                            : ""
                      }
                      readOnly
                      className="bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-mono text-sm resize-none min-h-[140px]"
                      placeholder={
                        showRecoveryPhrase || showPrivateKey ? "" : "Hidden"
                      }
                    />
                    {selectedSecret === "recovery" && !wallet?.mnemonic && (
                      <p className="mt-2 text-xs text-red-300">
                        This account was imported with a private key; no
                        recovery phrase exists. Create/recover a wallet with a
                        phrase to view it.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className="border-t border-[hsl(var(--border))]" />

              <div className="border-t border-[hsl(var(--border))]" />

              <section>
                <div className="mb-2 text-[hsl(var(--foreground))] font-medium">
                  
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full flex items-center gap-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/90"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>

                  <Button
                    onClick={handleDeleteAccount}
                    variant={confirmDelete ? "destructive" : "outline"}
                    className={`w-full flex items-center gap-2 ${
                      confirmDelete
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/90"
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {confirmDelete ? "Confirm Delete" : "Delete Account"}
                  </Button>

                  {confirmDelete && (
                    <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
                      <div className="flex items-center gap-2 text-red-200 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>This action cannot be undone</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                        className="mt-2 text-red-300 hover:text-red-200 hover:bg-red-400/20"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
