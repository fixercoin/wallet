import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Copy,
  LogOut,
  Trash2,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
  Twitter,
  Send,
  Headphones,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import bs58 from "bs58";

interface SettingsProps {
  onBack: () => void;
  onOpenSetup?: () => void;
  onDocumentation?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  onBack,
  onOpenSetup,
  onDocumentation,
}) => {
  const { wallet, wallets, logout, selectWallet } = useWallet();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  if (wallets.length === 0) {
    return (
      <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground p-4">
        <div className="w-full px-4 mx-auto pt-8">
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
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full relative z-20">
        <div>
          <div className="mt-6 mb-1 p-6 border-0 bg-transparent relative mx-0">
            <div className="flex items-center gap-3 -mt-4 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-sm text-gray-900">ACCOUNTS</div>
            </div>
            <div className="space-y-3 md:space-y-6 px-4 sm:px-6">
              <Card className="w-full bg-transparent rounded-lg border border-gray-300/30">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 rounded-none transition-colors">
                    <div className="min-w-0 w-full">
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
                          className="flex-1 bg-transparent text-[hsl(var(--foreground))] p-2 pr-6 rounded-md font-mono"
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recovery Phrase Card */}
              <Card className="w-full bg-transparent rounded-lg border border-gray-300/30">
                <CardContent className="p-0">
                  <button
                    onClick={() => {
                      if (wallet?.mnemonic) {
                        setRecoveryPhrase(wallet.mnemonic);
                        setShowRecoveryPhrase(!showRecoveryPhrase);
                        setShowPrivateKey(false);
                      } else {
                        toast({
                          title: "Recovery Phrase Unavailable",
                          description:
                            "Recovery phrase is not available for this wallet",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-none transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                      <Key className="h-5 w-5" />
                      <span className="font-medium">RECOVERY PHRASE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {showRecoveryPhrase && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyRecoveryPhrase();
                          }}
                          className="h-8 px-2 bg-white/10 hover:bg-white/20 text-gray-900 rounded-md"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {showRecoveryPhrase ? (
                        <EyeOff className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                  </button>
                  {showRecoveryPhrase && (
                    <div className="px-4 pb-4">
                      <Textarea
                        value={recoveryPhrase}
                        readOnly
                        className="bg-white/5 text-gray-900 font-mono text-sm resize-none min-h-[120px] rounded-md"
                      />
                    </div>
                  )}
                  {!wallet?.mnemonic && (
                    <div className="px-4 pb-4">
                      <p className="text-xs text-red-400">
                        This account was imported with a private key; no
                        recovery phrase exists. Create/recover a wallet with a
                        phrase to view it.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Private Key Card */}
              <Card className="w-full bg-transparent rounded-lg border border-gray-300/30">
                <CardContent className="p-0">
                  <button
                    onClick={() => {
                      if (privateKeyBase58) {
                        setShowPrivateKey(!showPrivateKey);
                        setShowRecoveryPhrase(false);
                      } else {
                        toast({
                          title: "Private Key Unavailable",
                          description:
                            "Private key is not available for this wallet",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-none transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                      <Key className="h-5 w-5" />
                      <span className="font-medium">PRIVATE KEY</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {showPrivateKey && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPrivateKey();
                          }}
                          className="h-8 px-2 bg-white/10 hover:bg-white/20 text-gray-900 rounded-md"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {showPrivateKey ? (
                        <EyeOff className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                  </button>
                  {showPrivateKey && (
                    <div className="px-4 pb-4">
                      <Textarea
                        value={privateKeyBase58}
                        readOnly
                        className="bg-white/5 text-gray-900 font-mono text-sm resize-none min-h-[120px] rounded-md"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documentation Card */}
              {/* Helpline Card */}
              <Card className="w-full bg-transparent rounded-lg border border-gray-300/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[hsl(var(--foreground))]">
                      CONTACT
                    </span>
                    <div className="flex items-center gap-3">
                      <a
                        href="https://twitter.com/fixorium"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-md transition-colors text-gray-600 hover:text-gray-900"
                        aria-label="Twitter"
                      >
                        <Twitter className="h-5 w-5" />
                      </a>
                      <a
                        href="https://t.me/fixorium"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-md transition-colors text-gray-600 hover:text-gray-900"
                        aria-label="Telegram"
                      >
                        <Send className="h-5 w-5" />
                      </a>
                      {onDocumentation && (
                        <button
                          onClick={onDocumentation}
                          className="p-2 hover:bg-white/10 rounded-md transition-colors text-gray-600 hover:text-gray-900"
                          aria-label="Documentation"
                        >
                          <Headphones className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <section>
                <div className="mb-2 text-[hsl(var(--foreground))] font-medium"></div>
                <div className="space-y-3">
                  <div className="px-0 sm:px-4">
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <Button
                        onClick={handleLogout}
                        variant="default"
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </Button>

                      <Button
                        onClick={handleDeleteAccount}
                        variant="default"
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg ${
                          confirmDelete
                            ? "bg-green-700 hover:bg-green-800 text-white"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                        {confirmDelete ? "Confirm Delete" : "Delete Account"}
                      </Button>
                    </div>
                  </div>

                  {confirmDelete && (
                    <div className="p-3 bg-red-500/20 rounded-[2px]">
                      <div className="flex items-center gap-2 text-red-200 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>This action cannot be undone</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                        className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
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
