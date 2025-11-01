import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Copy,
  LogOut,
  Trash2,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
  DollarSign,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useCurrency } from "@/contexts/CurrencyContext";
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
  const { currency, setCurrency } = useCurrency();

  if (wallets.length === 0) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white p-4">
        <div className="w-full max-w-md mx-auto pt-8 px-4">
          <div className="bg-transparent shadow-none rounded-lg p-6">
            <div className="p-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))]">
                No accounts available. Create a wallet from the dashboard using
                the + button.
              </p>
              <div className="mt-4">
                <Button
                  onClick={onBack}
                  className="w-full bg-[#2d1b47]/50 text-white"
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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full max-w-md mx-auto p-4 py-6 relative z-20">
        <div>
          <div className="rounded-lg border border-[#555555]/30 bg-gradient-to-br from-[#2d1b47]/60 to-[#1f0f3d]/60 shadow-none overflow-hidden p-6">
            <div className="flex items-center gap-3 -mt-4 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-[#a855f7]/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-sm">ACCOUNTS</div>
            </div>
            <div className="space-y-6">
              <section>
                <div className="mb-2 text-[hsl(var(--foreground))] font-medium">
                  SELECT ACCOUNT
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
                    className="flex-1 bg-[#2d1b47]/50 text-white p-2 rounded-md border border-[#a855f7]/30 font-mono"
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

              <section>
                <div className="mb-3 flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-medium">CURRENCY PREFERENCE</span>
                </div>
                <Select
                  value={currency}
                  onValueChange={(value) => {
                    const selectedCurrency = value as "USD" | "PKR";
                    setCurrency(selectedCurrency);
                    try {
                      localStorage.setItem(
                        "preferred_currency",
                        selectedCurrency,
                      );
                    } catch {}
                    toast({
                      title: "Currency Changed",
                      description: `Currency preference set to ${selectedCurrency}`,
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d1b47]/95 border border-[#a855f7]/30">
                    <SelectItem value="USD" className="text-white">
                      USD (United States Dollar)
                    </SelectItem>
                    <SelectItem value="PKR" className="text-white">
                      PKR (Pakistani Rupee)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-[hsl(var(--foreground))]">
                  <Key className="h-5 w-5" />
                  <span className="font-medium">SECRETS</span>
                </div>
                <div className="space-y-2">
                  <div className="bg-transparent border-0 rounded-lg">
                    <div className="flex gap-3 mb-3">
                      <select
                        aria-label="Select secret"
                        value={selectedSecret}
                        onChange={(e) =>
                          setSelectedSecret(
                            e.target.value as "recovery" | "private",
                          )
                        }
                        className="flex-1 bg-[#2d1b47]/50 text-white p-2 rounded-md border border-[#a855f7]/30 font-mono"
                      >
                        <option value="recovery">RECOVERY PHRASE</option>
                        <option value="private">PRIVATE KEY</option>
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
                        className="bg-transparent text-white p-1 rounded-md border border-[#FF7A5C]/30"
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
                      className="bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white font-mono text-sm resize-none min-h-[140px]"
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

              <section>
                <div className="mb-2 text-[hsl(var(--foreground))] font-medium"></div>
                <div className="space-y-3">
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full flex items-center gap-2 bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white hover:bg-[#FF7A5C]/10"
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
                        : "bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white hover:bg-[#FF7A5C]/10"
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
