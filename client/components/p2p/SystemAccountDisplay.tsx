import React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSystemSellerWallet,
  getSystemBuyerAccount,
} from "@/lib/constants/system-config";

interface SystemAccountDisplayProps {
  type: "buyer" | "seller";
  variant?: "default" | "compact";
}

export const SystemAccountDisplay: React.FC<SystemAccountDisplayProps> = ({
  type,
  variant = "default",
}) => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (type === "buyer") {
    const buyerAccount = getSystemBuyerAccount();

    if (variant === "compact") {
      return (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900 mb-2">
            <strong>Pay to this account:</strong>
          </p>
          <div className="space-y-1 text-xs text-blue-800">
            <div className="flex justify-between items-center gap-2">
              <span>{buyerAccount.accountName}</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    buyerAccount.accountName,
                    "buyer-name",
                  )
                }
                className="text-blue-600 hover:text-blue-800"
              >
                {copied === "buyer-name" ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span>📞 {buyerAccount.accountNumber}</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    buyerAccount.accountNumber,
                    "buyer-number",
                  )
                }
                className="text-blue-600 hover:text-blue-800"
              >
                {copied === "buyer-number" ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span>💳 {buyerAccount.paymentMethod.toUpperCase()}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            📤 Send Payment To:
          </h3>
          <div className="bg-white rounded border border-blue-100 p-3 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-xs text-gray-600">Account Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {buyerAccount.accountName}
                </p>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    buyerAccount.accountName,
                    "buyer-name",
                  )
                }
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
              >
                {copied === "buyer-name" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-xs text-gray-600">Account Number</p>
                <p className="text-sm font-medium text-gray-900 font-mono">
                  {buyerAccount.accountNumber}
                </p>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    buyerAccount.accountNumber,
                    "buyer-number",
                  )
                }
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
              >
                {copied === "buyer-number" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-600">Payment Method</p>
              <p className="text-sm font-medium text-gray-900">
                {buyerAccount.paymentMethod}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-100 border border-blue-300 rounded p-2">
          <p className="text-xs text-blue-900">
            ✓ This is the official system account. Send your payment here
            to complete the transaction securely.
          </p>
        </div>
      </div>
    );
  }

  const sellerWallet = getSystemSellerWallet();

  if (variant === "compact") {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-xs text-green-900 mb-2">
          <strong>Send crypto to:</strong>
        </p>
        <div className="flex justify-between items-center gap-2">
          <span className="text-xs font-mono text-green-800 truncate">
            {sellerWallet.slice(0, 8)}...{sellerWallet.slice(-8)}
          </span>
          <button
            onClick={() => copyToClipboard(sellerWallet, "seller-wallet")}
            className="text-green-600 hover:text-green-800"
          >
            {copied === "seller-wallet" ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-green-900 mb-3">
          🔐 Send Crypto To System Wallet:
        </h3>
        <div className="bg-white rounded border border-green-100 p-3 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <p className="text-xs text-gray-600 mb-1">Solana Wallet Address</p>
              <p className="text-xs font-mono text-gray-900 break-all">
                {sellerWallet}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(sellerWallet, "seller-wallet")}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded whitespace-nowrap"
            >
              {copied === "seller-wallet" ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-green-100 border border-green-300 rounded p-2">
        <p className="text-xs text-green-900">
          ✓ This is the official system wallet. Send your crypto here to
          complete the transaction securely.
        </p>
      </div>
    </div>
  );
};
