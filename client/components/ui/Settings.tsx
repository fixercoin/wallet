import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Copy,
  LogOut,
  Trash2,
  Wallet,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";

interface SettingsProps {
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { wallet, logout } = useWallet();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-md mx-auto pt-8">
          <Card className="bg-black/20 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-8 text-center">
              <p className="text-gray-300">No wallet found</p>
              <Button
                onClick={onBack}
                className="mt-4 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleCopyAddress = async () => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Accounts</h1>
        </div>

        <div className="space-y-6">
          {/* Wallet Info */}
          <Card className="bg-black/20 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5" />
                Wallet Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm rounded-lg">
                <div>
                  <p className="font-medium text-white">Address</p>
                  <p className="text-sm text-gray-400 font-mono">
                    {shortenAddress(wallet.publicKey, 8)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mx-4 sm:mx-0 border-b border-gray-300/30" />

          {/* Recovery Phrase */}
          <Card className="bg-black/20 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="h-5 w-5" />
                Recovery Phrase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showRecoveryPhrase ? (
                <div className="space-y-4">
                  <Button
                    onClick={handleShowRecoveryPhrase}
                    variant="outline"
                    className="w-full bg-white/10 text-white hover:bg-white/20"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Show Recovery Phrase
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      Your Recovery Phrase
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRecoveryPhrase(false)}
                        className="bg-white/10 text-white hover:bg-white/20"
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyRecoveryPhrase}
                        className="bg-white/10 text-white hover:bg-white/20"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={recoveryPhrase}
                    readOnly
                    className="bg-white/5 text-white font-mono text-sm resize-none min-h-[120px]"
                    placeholder="Recovery phrase will appear here..."
                  />
                  <Alert className="bg-red-500/20 text-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Make sure no one can see your screen. Store this phrase in
                      a safe place offline.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="mx-4 sm:mx-0 border-b border-gray-300/30" />

          {/* Account Actions */}
          <Card className="bg-black/20 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="px-4 sm:px-0">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-3 w-full">
                  <Button
                    onClick={handleLogout}
                    variant="default"
                    className="w-full sm:w-40 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>

                  <Button
                    onClick={handleDeleteAccount}
                    variant="default"
                    className={`w-full sm:w-40 flex items-center justify-center gap-2 ${
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
                <div className="p-3 bg-red-500/20 rounded-lg">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
