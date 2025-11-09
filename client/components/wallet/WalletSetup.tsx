import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Copy } from "lucide-react";
import {
  generateWallet,
  recoverWallet,
  copyToClipboard,
  importWalletFromPrivateKey,
} from "@/lib/wallet";
import { assertValidMnemonic, normalizeMnemonicInput } from "@/lib/mnemonic";
import { prefetchWalletAddressData } from "@/lib/services/address-setup";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { PasswordSetup } from "./PasswordSetup";
import {
  setWalletPassword,
  markWalletAsPasswordProtected,
} from "@/lib/wallet-password";

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

  // Password protection state
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<any>(null);
  const [passwordSetupMode, setPasswordSetupMode] = useState<
    "create" | "unlock"
  >("create");

  const normalizedRecoveryPhrase = normalizeMnemonicInput(recoveryPhrase);
  const recoveryWordCount = normalizedRecoveryPhrase
    ? normalizedRecoveryPhrase.split(" ").length
    : 0;
  const isMnemonicWordCountValid =
    recoveryWordCount === 12 || recoveryWordCount === 24;

  const {
    setWallet,
    refreshBalance,
    refreshTokens,
    needsPasswordUnlock,
    unlockWithPassword,
  } = useWallet();
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

  const handlePasswordSetup = async (password: string) => {
    if (!pendingWallet) {
      setShowPasswordSetup(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Set password in session and mark wallet as password protected
      setWalletPassword(password);
      markWalletAsPasswordProtected();

      // Set the wallet (will be encrypted on persist)
      setWallet(pendingWallet);

      // Prefetch address data via RPC providers
      void prefetchWalletAddressData(pendingWallet.publicKey).catch(
        () => undefined,
      );

      await refreshBalance().catch(() => {});
      await refreshTokens().catch(() => {});

      toast({
        title: "Wallet Secured",
        description:
          "Your wallet has been created and encrypted with your password.",
      });

      setShowPasswordSetup(false);
      setPendingWallet(null);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverWallet = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const normalizedMnemonic = assertValidMnemonic(recoveryPhrase);
      setRecoveryPhrase(normalizedMnemonic);

      const walletData = recoverWallet(normalizedMnemonic);

      // Show password setup for new wallet import
      setPendingWallet(walletData);
      setPasswordSetupMode("create");
      setShowPasswordSetup(true);
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

    // Show password setup for new wallet creation
    setPendingWallet(generatedWallet);
    setPasswordSetupMode("create");
    setShowPasswordSetup(true);
  };

  const handleUnlockWallets = async (password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const success = await unlockWithPassword(password);

      if (success) {
        setWalletPassword(password);
        toast({
          title: "Wallets Unlocked",
          description: "Your wallets have been decrypted successfully.",
        });
        setShowPasswordSetup(false);
        onComplete();
      } else {
        setError("Invalid password. Please try again.");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to unlock wallets",
      );
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

  // Show password unlock modal if wallets are encrypted but not unlocked
  if (needsPasswordUnlock && !pendingWallet && !showPasswordSetup) {
    return (
      <>
        <PasswordSetup
          isOpen={true}
          onConfirm={handleUnlockWallets}
          onCancel={() => {
            // Allow canceling unlock to show main menu
            setShowPasswordSetup(false);
          }}
          isLoading={isLoading}
          title="Unlock Your Wallets"
          description="Enter your password to decrypt your wallets"
          mode="unlock"
        />
        {/* Main welcome screen */}
        <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
          {/* Decorative bottom green wave (SVG) */}
          <svg
            className="bottom-wave z-0"
            viewBox="0 0 1440 220"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e6ffed" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C240,180 480,20 720,80 C960,140 1200,40 1440,110 L1440,220 L0,220 Z"
              fill="url(#g1)"
              opacity="0.95"
            />
          </svg>

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
                  <p className="text-center text-gray-600">
                    Your wallets are encrypted and locked. Please enter your
                    password above to unlock them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Password setup modal
  const passwordSetupTitle =
    passwordSetupMode === "create"
      ? "Secure Your Wallet with a Password"
      : "Unlock Your Wallets";
  const passwordSetupDescription =
    passwordSetupMode === "create"
      ? "Create a strong password to encrypt your private keys. This protects your wallet from unauthorized access."
      : "Enter your password to decrypt your wallets";

  // Main welcome screen
  if (activeTab === "create" && !generatedWallet) {
    return (
      <>
        <PasswordSetup
          isOpen={showPasswordSetup}
          onConfirm={
            passwordSetupMode === "create"
              ? handlePasswordSetup
              : handleUnlockWallets
          }
          onCancel={() => {
            setShowPasswordSetup(false);
            setPendingWallet(null);
          }}
          isLoading={isLoading}
          title={passwordSetupTitle}
          description={passwordSetupDescription}
          mode={passwordSetupMode}
        />
        <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
          {/* Decorative bottom green wave (SVG) */}
          <svg
            className="bottom-wave z-0"
            viewBox="0 0 1440 220"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e6ffed" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C240,180 480,20 720,80 C960,140 1200,40 1440,110 L1440,220 L0,220 Z"
              fill="url(#g1)"
              opacity="0.95"
            />
          </svg>

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
                    className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white shadow-lg hover:shadow-2xl transition-all"
                  >
                    CREATE NEW WALLET
                  </Button>

                  <Button
                    onClick={() => setActiveTab("recover")}
                    variant="ghost"
                    className="w-full h-12 rounded-xl text-white hover:bg-[#16a34a]/10"
                  >
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
      </>
    );
  }

  // Recovery screen
  if (activeTab === "recover") {
    return (
      <>
        <PasswordSetup
          isOpen={showPasswordSetup}
          onConfirm={
            passwordSetupMode === "create"
              ? handlePasswordSetup
              : handleUnlockWallets
          }
          onCancel={() => {
            setShowPasswordSetup(false);
            setPendingWallet(null);
          }}
          isLoading={isLoading}
          title={passwordSetupTitle}
          description={passwordSetupDescription}
          mode={passwordSetupMode}
        />
        <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
          {/* Decorative bottom green wave (SVG) */}
          <svg
            className="bottom-wave z-0"
            viewBox="0 0 1440 220"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e6ffed" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C240,180 480,20 720,80 C960,140 1200,40 1440,110 L1440,220 L0,220 Z"
              fill="url(#g1)"
              opacity="0.95"
            />
          </svg>

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
                        className="text-white hover:bg-[#16a34a]/10"
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
                        className="w-full h-32 p-4 bg-[#083c2c]/50 rounded-none border border-white/80 text-white placeholder:text-gray-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
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
                      className="w-full h-32 p-4 bg-[#083c2c]/50 rounded-none border border-white/80 text-white placeholder:text-gray-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("create")}
                    className="flex-1 h-12 rounded-xl bg-[#083c2c]/50 text-white hover:bg-[#16a34a]/10 uppercase"
                  >
                    Back
                  </Button>
                  {recoverMode === "mnemonic" ? (
                    <Button
                      onClick={handleRecoverWallet}
                      disabled={!isMnemonicWordCountValid || isLoading}
                      className="flex-1 h-12 rounded-xl font-semibold uppercase bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white shadow-lg hover:shadow-2xl transition-all"
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
                          // Prefetch address data via RPC providers (Helius, Moralis, etc.)
                          void prefetchWalletAddressData(
                            walletData.publicKey,
                          ).catch(() => undefined);
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
                      className="flex-1 h-12 rounded-xl font-semibold uppercase bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white shadow-lg hover:shadow-2xl transition-all"
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
      </>
    );
  }

  // Mnemonic display screen
  if (activeTab === "mnemonic" && generatedWallet) {
    return (
      <>
        <PasswordSetup
          isOpen={showPasswordSetup}
          onConfirm={
            passwordSetupMode === "create"
              ? handlePasswordSetup
              : handleUnlockWallets
          }
          onCancel={() => {
            setShowPasswordSetup(false);
            setPendingWallet(null);
          }}
          isLoading={isLoading}
          title={passwordSetupTitle}
          description={passwordSetupDescription}
          mode={passwordSetupMode}
        />
        <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
          {/* Decorative bottom green wave (SVG) */}
          <svg
            className="bottom-wave z-0"
            viewBox="0 0 1440 220"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e6ffed" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C240,180 480,20 720,80 C960,140 1200,40 1440,110 L1440,220 L0,220 Z"
              fill="url(#g1)"
              opacity="0.95"
            />
          </svg>

          <div className="w-full min-h-screen flex flex-col items-center justify-center relative z-10 p-4">
            <div className="relative w-full max-w-md mx-auto bg-transparent overflow-hidden">
              {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
                  <div className="text-white">Creating wallet...</div>
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMnemonic(!showMnemonic)}
                      className="bg-[#083c2c]/50 text-white hover:bg-[#16a34a]/10"
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
                      className="bg-[#083c2c]/50 text-white hover:bg-[#16a34a]/10"
                    >
                      <Copy className="h-4 w-4" />
                      Copy All
                    </Button>
                  </div>
                </div>

                <div className="bg-[#064e3b]/50 rounded-xl p-6">
                  <div className="grid grid-cols-3 gap-3">
                    {generatedWallet.mnemonic
                      .split(" ")
                      .map((word: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-[#0d3d2d]/50 rounded p-2"
                        >
                          <span className="text-xs font-semibold text-gray-300 min-w-[1.5rem]">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-white truncate">
                            {showMnemonic ? word : "••••••"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("create")}
                    className="flex-1 h-12 rounded-xl bg-[#083c2c]/50 text-white hover:bg-[#16a34a]/10 uppercase"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirmWallet}
                    className="flex-1 h-12 rounded-xl font-semibold bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white shadow-lg hover:shadow-2xl transition-all"
                  >
                    Create Wallet
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
};
