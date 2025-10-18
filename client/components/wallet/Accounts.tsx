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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-[#FF7A5C]/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            Accounts
          </h1>
        </div>

        <div className="bg-transparent border-0 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Active Wallet
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="font-semibold text-[hsl(var(--foreground))]">
                  {wallet ? shortenAddress(wallet.publicKey, 8) : "No wallet"}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="ml-2"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Button
                onClick={() => onOpenSetup && onOpenSetup()}
                className="h-10 w-10 p-0 rounded-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white shadow-sm"
                aria-label="Add wallet"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <div className="text-sm mb-2 text-[hsl(var(--foreground))] font-medium">
              All Accounts
            </div>
            <div className="space-y-2">
              {wallets.map((w) => (
                <div
                  key={w.publicKey}
                  className="w-full p-3 bg-[#1a2540]/50 border border-[#FF7A5C]/30 rounded-md flex items-center gap-2"
                >
                  <button
                    onClick={() => {
                      selectWallet(w.publicKey);
                      onBack();
                    }}
                    className="text-left flex-1"
                    title="Select this wallet"
                  >
                    <div className="font-medium">
                      {w.label ? w.label : shortenAddress(w.publicKey, 8)}
                    </div>
                    {w.label ? (
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {shortenAddress(w.publicKey, 8)}
                      </div>
                    ) : null}
                  </button>

                  {editingKey === w.publicKey ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        placeholder="Enter name"
                        className="h-8 w-36"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          updateWalletLabel(w.publicKey, labelInput.trim());
                          setEditingKey(null);
                          setLabelInput("");
                        }}
                        className="h-8 px-2"
                        aria-label="Save"
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
                        className="h-8 px-2"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingKey(w.publicKey);
                        setLabelInput(w.label || "");
                      }}
                      className="h-8 px-2"
                      aria-label="Edit name"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
