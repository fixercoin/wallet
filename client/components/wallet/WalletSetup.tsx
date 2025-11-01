import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Copy, Import, Plus } from "lucide-react";
import {
  generateWallet,
  recoverWallet,
  copyToClipboard,
  importWalletFromPrivateKey,
} from "@/lib/wallet";
import { assertValidMnemonic, normalizeMnemonicInput } from "@/lib/mnemonic";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

interface WalletSetupProps {
  onComplete: () => void;
}

export const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return (sessionStorage.getItem("wallet_setup_tab") as string) || "create";
    } catch {
      return "create";
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create wallet state
  const [generatedWallet, setGeneratedWallet] = useState<any>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [confirmedMnemonic, setConfirmedMnemonic] = useState(false);

  // Recover wallet state
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>("");
  const [recoverMode, setRecoverMode] = useState<"mnemonic" | "privateKey">(
    "mnemonic",
  );
  const [privateKeyInput, setPrivateKeyInput] = useState<string>("");
  const [showPrivateKeyInput, setShowPrivateKeyInput] = useState(false);

  const normalizedRecoveryPhrase = normalizeMnemonicInput(recoveryPhrase);
  const recoveryWordCount = normalizedRecoveryPhrase
    ? normalizedRecoveryPhrase.split(" ").length
    : 0;
  const isMnemonicWordCountValid =
    recoveryWordCount === 12 || recoveryWordCount === 24;

  const { setWallet, refreshBalance, refreshTokens } = useWallet();
  const { toast } = useToast();

  const handleCreateWallet = () => {
    try {
      setError(null);
      const newWallet = generateWallet();
      setGeneratedWallet(newWallet);
      setActiveTab("mnemonic");
    } catch (error) {
      console.error("Wallet generation error:", error);
      setError(`Failed to generate wallet: ${(error as Error).message}`);
    }
  };

  const handleRecoverWallet = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const normalizedMnemonic = assertValidMnemonic(recoveryPhrase);
      setRecoveryPhrase(normalizedMnemonic);

      const walletData = recoverWallet(normalizedMnemonic);
      setWallet(walletData);

      await refreshBalance().catch(() => {});
      await refreshTokens().catch(() => {});

      toast({
        title: "Wallet Recovered",
        description: "Successfully recovered your wallet from recovery phrase.",
      });

      onComplete();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to recover wallet",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmWallet = async () => {
    if (!generatedWallet) return;
    setIsLoading(true);
    try {
      setWallet(generatedWallet);
      await refreshBalance().catch(() => {});
      await refreshTokens().catch(() => {});

      toast({
        title: "Wallet Created",
        description: "Your new Solana wallet has been created successfully.",
      });
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const copyFullMnemonic = async () => {
    if (!generatedWallet?.mnemonic) return;
    const success = await copyToClipboard(generatedWallet.mnemonic);
    if (success) {
      toast({
        title: "Copied",
        description: "Recovery phrase copied to clipboard",
      });
    } else {
      toast({
        title: "Copy Failed",
        description:
          "Could not copy recovery phrase. Please copy it manually from above.",
        variant: "destructive",
      });
    }
  };

  // Main welcome screen
  if (activeTab === "create" && !generatedWallet) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

        <div className="w-full min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-md mx-auto bg-transparent overflow-hidden">
            <div className="space-y-6">
              <div className="text-center pb-2">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2F3a15ce16386647f69de330d7428809d3%2F91b2877faec14ea19595368b705b1709?format=webp&width=800"
                  alt="Wallet"
                  className="mx-auto w-[240px] h-[240px] object-contain"
                />
              </div>

              <div className="space-y-4">
                <Button
                  onClick={handleCreateWallet}
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-2xl transition-all"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  CREATE NEW WALLET
                </Button>

                <Button
                  onClick={() => setActiveTab("recover")}
                  variant="ghost"
                  className="w-full h-12 rounded-xl text-white hover:bg-[#a855f7]/10"
                >
                  <Import className="h-5 w-5 mr-2" />
                  IMPORT WALLET
                </Button>

                {error && (
                  <Alert className="bg-red-500/10 text-red-200">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Recovery screen
  if (activeTab === "recover") {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

        <div className="w-full min-h-screen flex flex-col items-center justify-center relative z-10 p-4">
          <div className="relative w-full max-w-md mx-auto bg-transparent overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
                <div className="text-white">Importing wallet...</div>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span
                      onClick={() => setRecoverMode("mnemonic")}
                      className={`${recoverMode === "mnemonic" ? "font-semibold" : "opacity-70"} cursor-pointer uppercase`}
                    >
                      Recovery Phrase
                    </span>
                    <span
                      onClick={() => setRecoverMode("privateKey")}
                      className={`${recoverMode === "privateKey" ? "font-semibold" : "opacity-70"} cursor-pointer uppercase`}
                    >
                      Private Key
                    </span>
                  </div>
                  {recoverMode === "privateKey" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrivateKeyInput((s) => !s)}
                      className="text-white hover:bg-[#a855f7]/10"
                    >
                      {showPrivateKeyInput ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {recoverMode === "mnemonic" ? (
                  <div className="space-y-2">
                    <textarea
                      value={recoveryPhrase}
                      onChange={(e) => setRecoveryPhrase(e.target.value)}
                      placeholder="Paste your 12 or 24-word recovery phrase here..."
                      aria-label="Recovery Phrase"
                      className="w-full h-32 p-4 bg-[#1a2540]/50 rounded-none border border-white/80 text-white placeholder:text-gray-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="text-xs text-gray-300">
                      Derivation Path (Solana default) →
                      <span className="ml-2 font-mono text-[11px] text-gray-300">
                        m/44&apos;/501&apos;/0&apos;/0&apos;
                      </span>
                      <span className="ml-1 text-gray-300">
                        (compatible with Phantom and other Solana wallets)
                      </span>
                    </p>
                  </div>
                ) : (
                  <textarea
                    value={privateKeyInput}
                    onChange={(e) => setPrivateKeyInput(e.target.value)}
                    placeholder={
                      showPrivateKeyInput
                        ? "Paste your private key here (base58/base64/hex/JSON array)"
                        : "Hidden"
                    }
                    aria-label="Private Key"
                    className="w-full h-32 p-4 bg-[#1a2540]/50 rounded-none border border-white/80 text-white placeholder:text-gray-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("create")}
                  className="flex-1 h-12 rounded-xl bg-[#1a2540]/50 text-white hover:bg-[#FF7A5C]/10 uppercase"
                >
                  Back
                </Button>
                {recoverMode === "mnemonic" ? (
                  <Button
                    onClick={handleRecoverWallet}
                    disabled={!isMnemonicWordCountValid || isLoading}
                    className="flex-1 h-12 rounded-xl font-semibold uppercase bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-2xl transition-all"
                  >
                    Recover Wallet
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        const walletData =
                          importWalletFromPrivateKey(privateKeyInput);
                        setWallet(walletData);
                        await refreshBalance().catch(() => {});
                        await refreshTokens().catch(() => {});
                        toast({
                          title: "Wallet Imported",
                          description: "Imported wallet from private key.",
                        });
                        onComplete();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Failed to import private key",
                        );
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={!privateKeyInput.trim()}
                    className="flex-1 h-12 rounded-xl font-semibold uppercase bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-2xl transition-all"
                  >
                    Import Wallet
                  </Button>
                )}
              </div>

              {error && (
                <Alert className="bg-red-500/10 text-red-200">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mnemonic display screen
  if (activeTab === "mnemonic" && generatedWallet) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

        <div className="w-full min-h-screen flex flex-col items-center justify-center relative z-10 p-4">
          <div className="relative w-full max-w-md mx-auto bg-transparent overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
                <div className="text-white">Creating wallet...</div>
              </div>
            )}

            <div className="space-y-6">
              <div className="text-center">
                <div className="text-2xl font-bold">Secret Recovery Phrase</div>
                <div className="opacity-80">
                  Save these words in a safe place. They&apos;re the only way to
                  recover your wallet.
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">
                    Recovery Phrase
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMnemonic(!showMnemonic)}
                      className="bg-[#1a2540]/50 text-white hover:bg-[#FF7A5C]/10"
                    >
                      {showMnemonic ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      {showMnemonic ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyFullMnemonic}
                      className="bg-[#1a2540]/50 text-white hover:bg-[#FF7A5C]/10"
                    >
                      <Copy className="h-4 w-4" />
                      Copy All
                    </Button>
                  </div>
                </div>

                <div className="bg-[#1a2540]/50 rounded-xl p-6">
                  <p className="text-xs leading-relaxed text-center uppercase tracking-wide">
                    {showMnemonic
                      ? generatedWallet.mnemonic
                      : "••••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••��•••••• •••••••••• •••••••••• •••••••••• •••••••••• ••••••••••"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confirm-backup"
                  checked={confirmedMnemonic}
                  onChange={(e) => setConfirmedMnemonic(e.target.checked)}
                  className="rounded bg-[#1a2540]/50"
                />
                <Label htmlFor="confirm-backup" className="text-sm opacity-80">
                  I have safely backed up my recovery phrase
                </Label>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("create")}
                  className="flex-1 h-12 rounded-xl bg-[#1a2540]/50 text-white hover:bg-[#FF7A5C]/10 uppercase"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirmWallet}
                  disabled={!confirmedMnemonic}
                  className="flex-1 h-12 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-2xl transition-all"
                >
                  Create Wallet
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
