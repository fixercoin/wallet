import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Plus, Edit2, Save, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Input } from "@/components/ui/input";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";

interface AccountsProps {
  onBack: () => void;
  onOpenSetup?: () => void;
}

export const Accounts: React.FC<AccountsProps> = ({ onBack, onOpenSetup }) => {
  const { wallet, wallets, selectWallet, updateWalletLabel } = useWallet();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState<string>("");

  const handleCopy = async () => {
    if (!wallet) return;
    await copyToClipboard(wallet.publicKey);
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
      <div className="w-full">
        <div className="mb-1 p-6 border-0 bg-transparent relative mx-0">
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
            <h1 className="text-lg font-semibold text-gray-900 uppercase">
              ACCOUNTS
            </h1>
          </div>

          <div className="px-6 pb-4 space-y-4 w-full">
            <div>
              <div className="text-sm mb-2 text-[hsl(var(--muted-foreground))] uppercase">
                ACTIVE WALLET
              </div>
              <div className="w-full">
                <div className="bg-transparent border border-gray-300/30 rounded-lg p-4 flex flex-row items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gray-900 truncate flex-1 min-w-0">
                    {wallet ? shortenAddress(wallet.publicKey, 6) : "NO WALLET"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    aria-label="COPY ADDRESS"
                    className="text-gray-900 hover:bg-white/10 flex-shrink-0 h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    onClick={() => onOpenSetup && onOpenSetup()}
                    className="h-8 w-8 p-0 rounded-full bg-gradient-to-r from-[#34d399] to-[#22c55e] text-white shadow-sm flex-shrink-0"
                    aria-label="ADD WALLET"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm mb-2 text-[hsl(var(--foreground))] font-medium uppercase">
                ALL ACCOUNTS
              </div>
              <div className="space-y-2">
                {wallets.map((w) => (
                  <div key={w.publicKey}>
                    {editingKey === w.publicKey ? (
                      <div className="w-full p-3 bg-transparent md:border md:border-gray-300/30 rounded-lg flex flex-row items-center gap-2">
                        <Input
                          value={labelInput}
                          onChange={(e) => setLabelInput(e.target.value)}
                          placeholder="ENTER NAME"
                          className="h-8 flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            updateWalletLabel(w.publicKey, labelInput.trim());
                            setEditingKey(null);
                            setLabelInput("");
                          }}
                          className="h-8 w-8 p-0 flex-shrink-0"
                          aria-label="SAVE"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingKey(null);
                            setLabelInput("");
                          }}
                          className="h-8 w-8 p-0 flex-shrink-0"
                          aria-label="CANCEL"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full p-3 bg-transparent border border-gray-300/30 rounded-lg flex flex-row items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            console.log(
                              `[Accounts] Selected wallet: ${w.publicKey}`,
                            );
                            selectWallet(w.publicKey);
                            onBack();
                          }}
                          className="text-left flex-1 min-w-0 truncate"
                          title="SELECT THIS WALLET"
                        >
                          <span className="text-sm font-medium truncate block">
                            {w.label ? w.label : shortenAddress(w.publicKey, 6)}
                          </span>
                          {w.label ? (
                            <span className="text-xs text-[hsl(var(--muted-foreground))] truncate block">
                              {shortenAddress(w.publicKey, 6)}
                            </span>
                          ) : null}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingKey(w.publicKey);
                            setLabelInput(w.label || "");
                          }}
                          className="h-8 w-8 p-0 flex-shrink-0"
                          aria-label="EDIT NAME"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
