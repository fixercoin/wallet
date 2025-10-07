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
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-6">
            <div className="text-center pb-6">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2F3a15ce16386647f69de330d7428809d3%2F91b2877faec14ea19595368b705b1709?format=webp&width=800"
                alt="Wallet"
                className="mx-auto w-[300px] h-[300px] object-contain"
              />
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleCreateWallet}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold rounded-2xl border-0 shadow-lg uppercase"
              >
                <Plus className="h-5 w-5 mr-2" />
                CREATE NEW WALLET
              </Button>

              <Button
                onClick={() => setActiveTab("recover")}
                variant="ghost"
                className="w-full h-12 rounded-2xl uppercase"
              >
                <Import className="h-5 w-5 mr-2" />
                IMPORT WALLET
              </Button>

              {error && (
                <Alert
                  className="mt-4 bg-red-500/20 border-red-400/30 text-red-200"
                  variant="destructive"
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Recovery screen
  if (activeTab === "recover") {
    return (
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-6">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 rounded-lg">
                <div className="text-[hsl(var(--muted-foreground))]">
                  Importing wallet...
                </div>
              </div>
            )}

            <div className="text-center"></div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      onClick={() => setRecoverMode("mnemonic")}
                      className={`cursor-pointer ${recoverMode === "mnemonic" ? "text-[hsl(var(--foreground))] font-semibold" : "text-[hsl(var(--muted-foreground))]"}`}
                    >
                      Recovery Phrase
                    </span>
                    <span
                      onClick={() => setRecoverMode("privateKey")}
                      className={`cursor-pointer ${recoverMode === "privateKey" ? "text-[hsl(var(--foreground))] font-semibold" : "text-[hsl(var(--muted-foreground))]"}`}
                    >
                      Private Key
                    </span>
                  </div>
                  {recoverMode === "privateKey" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrivateKeyInput((s) => !s)}
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
                      className="w-full h-32 p-4 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/40 focus:border-yellow-500/50"
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Derivation Path (Solana default) →
                      <span className="ml-2 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                        m/44&apos;/501&apos;/0&apos;/0&apos;
                      </span>
                      <span className="ml-1 text-[hsl(var(--muted-foreground))]">
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
                    className="w-full h-32 p-4 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/40 focus:border-yellow-500/50"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("create")}
                  className="flex-1"
                >
                  Back
                </Button>
                {recoverMode === "mnemonic" ? (
                  <Button
                    onClick={handleRecoverWallet}
                    disabled={!isMnemonicWordCountValid || isLoading}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg"
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
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg"
                  >
                    Import Wallet
                  </Button>
                )}
              </div>

              {error && (
                <Alert
                  variant="destructive"
                  className="bg-red-500/20 border-red-400/30 text-red-200"
                >
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
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg p-6">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 rounded-lg">
                <div className="text-[hsl(var(--muted-foreground))]">
                  Creating wallet...
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--foreground))]">
                Secret Recovery Phrase
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">
                Save these words in a safe place. They're the only way to
                recover your wallet.
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold text-[hsl(var(--foreground))]">
                    Recovery Phrase
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMnemonic(!showMnemonic)}
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
                    >
                      <Copy className="h-4 w-4" />
                      Copy All
                    </Button>
                  </div>
                </div>

                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                  <p className="text-[hsl(var(--muted-foreground))] text-xs leading-relaxed text-center uppercase">
                    {showMnemonic
                      ? generatedWallet.mnemonic
                      : "••••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• •••••••••• ••••••••••"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confirm-backup"
                  checked={confirmedMnemonic}
                  onChange={(e) => setConfirmedMnemonic(e.target.checked)}
                  className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))]"
                />
                <Label
                  htmlFor="confirm-backup"
                  className="text-sm text-[hsl(var(--muted-foreground))]"
                >
                  I have safely backed up my recovery phrase
                </Label>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("create")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirmWallet}
                  disabled={!confirmedMnemonic}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg"
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
