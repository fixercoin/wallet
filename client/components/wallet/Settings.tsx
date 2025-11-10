import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Lock,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import {
  setWalletPassword,
  doesWalletRequirePassword,
  markWalletAsPasswordProtected,
  encryptStoredWalletsIfNeeded,
} from "@/lib/wallet-password";
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
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);

  React.useEffect(() => {
    const checkPassword = async () => {
      const hasPassword = await doesWalletRequirePassword();
      setPasswordEnabled(hasPassword);
    };
    checkPassword();
  }, []);

  if (wallets.length === 0) {
    return (
      <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground p-4">
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

  const handleSetPassword = async () => {
    if (!newPassword) {
      toast({
        title: "Error",
        description: "Please enter a password",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      await setWalletPassword(newPassword);
      markWalletAsPasswordProtected();
      encryptStoredWalletsIfNeeded();
      setPasswordEnabled(true);
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      toast({
        title: "Success",
        description:
          "Password set successfully. You will be prompted for it when you open the app.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full p-4 py-6 relative z-20">
        <div>
          <div className="mt-6 mb-1 rounded-lg p-6 border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden">
            <div className="flex items-center gap-3 -mt-4 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-none bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-sm text-gray-900">ACCOUNTS</div>
            </div>
            <div className="space-y-6">
              <Card className="bg-transparent rounded-none border border-gray-300/30">
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
                          className="flex-1 bg-gray-700 text-white p-2 pr-6 rounded-none font-mono"
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

              {/* Password Card */}
              <Card className="bg-transparent rounded-none border border-gray-300/30">
                <CardContent className="p-0">
                  <button
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="w-full flex items-center justify-between p-4 rounded-none transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                      <Lock className="h-5 w-5" />
                      <span className="font-medium">
                        {passwordEnabled ? "PASSWORD ENABLED" : "SET PASSWORD"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordEnabled && (
                        <span className="text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded-none">
                          Active
                        </span>
                      )}
                      <Eye className="h-4 w-4 text-gray-600" />
                    </div>
                  </button>
                  {showPasswordForm && (
                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <label className="text-xs text-gray-600 font-semibold uppercase block mb-2">
                          Password
                        </label>
                        <Input
                          type={showPasswordField ? "text" : "password"}
                          placeholder="Enter password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-white/5 border border-gray-300/30 text-gray-900 rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 font-semibold uppercase block mb-2">
                          Confirm Password
                        </label>
                        <Input
                          type={showPasswordField ? "text" : "password"}
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-white/5 border border-gray-300/30 text-gray-900 rounded-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="showPassword"
                          checked={showPasswordField}
                          onChange={(e) =>
                            setShowPasswordField(e.target.checked)
                          }
                          className="w-4 h-4 rounded-none"
                        />
                        <label
                          htmlFor="showPassword"
                          className="text-xs text-gray-600"
                        >
                          Show password
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSetPassword}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-none"
                        >
                          Set Password
                        </Button>
                        <Button
                          onClick={() => setShowPasswordForm(false)}
                          variant="outline"
                          className="flex-1 bg-transparent border border-gray-300/30 text-gray-900 rounded-none"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {passwordEnabled && !showPasswordForm && (
                    <div className="px-4 pb-4">
                      <p className="text-xs text-green-600">
                        Password protection is active. You will be prompted for
                        your password when you open the app.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recovery Phrase Card */}
              <Card className="bg-transparent rounded-none border border-gray-300/30">
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
                          className="h-8 px-2 bg-white/10 hover:bg-white/20 text-gray-900 rounded-none border border-gray-300/30"
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
                        className="bg-white/5 border border-gray-300/30 text-gray-900 font-mono text-sm resize-none min-h-[120px] rounded-none"
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
              <Card className="bg-transparent rounded-none border border-gray-300/30">
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
                          className="h-8 px-2 bg-white/10 hover:bg-white/20 text-gray-900 rounded-none border border-gray-300/30"
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
                        className="bg-white/5 border border-gray-300/30 text-gray-900 font-mono text-sm resize-none min-h-[120px] rounded-none"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* DApp Connected Card */}
              <Card className="bg-transparent rounded-none border border-gray-300/30">
                <CardContent className="p-0">
                  <div className="w-full flex items-center justify-between p-4 rounded-none">
                    <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                      <ExternalLink className="h-5 w-5" />
                      <span className="font-medium">DAPP CONNECTIONS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="/dapps"
                        className="text-xs text-gray-700 hover:underline"
                      >
                        Manage
                      </a>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Shows dapps this wallet has connected to. Manage
                      connections on the DApps page.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <section>
                <div className="mb-2 text-[hsl(var(--foreground))] font-medium"></div>
                <div className="space-y-3">
                  <Button
                    onClick={handleLogout}
                    variant="default"
                    className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-none"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>

                  <Button
                    onClick={handleDeleteAccount}
                    variant="default"
                    className={`w-full flex items-center gap-2 rounded-none ${
                      confirmDelete
                        ? "bg-green-700 hover:bg-green-800 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {confirmDelete ? "Confirm Delete" : "Delete Account"}
                  </Button>

                  {confirmDelete && (
                    <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-none">
                      <div className="flex items-center gap-2 text-red-200 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>This action cannot be undone</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                        className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-none"
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
