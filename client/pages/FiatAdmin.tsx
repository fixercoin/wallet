import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lock } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";

// Admin wallets configuration
// IMPORTANT: Keep this in sync with server/routes/fiat-system.ts ADMIN_WALLETS
// For development: update these hardcoded values
// For production: update the FIAT_ADMIN_WALLETS environment variable on the server
const ADMIN_WALLETS = [
  "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw", // Admin wallet
  // Add more admin wallet addresses here
];

export interface PriceRatio {
  usdtToPkr: number;
  pkrToUsdt: number;
  updatedBy: string;
  timestamp: string;
}

export default function FiatAdmin() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [priceRatio, setPriceRatio] = useState<PriceRatio | null>(null);
  const [newRatio, setNewRatio] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (wallet) {
      setIsAdmin(ADMIN_WALLETS.includes(wallet));
    }
  }, [wallet]);

  useEffect(() => {
    const fetchPriceRatio = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/fiat/price-ratio");
        const data = await response.json();
        setPriceRatio(data);
        setNewRatio(data.usdtToPkr.toString());
      } catch (error) {
        console.error("Error fetching price ratio:", error);
        toast.error("Failed to load price ratio");
      } finally {
        setLoading(false);
      }
    };

    fetchPriceRatio();
  }, []);

  const handleUpdateRatio = async () => {
    if (!wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!newRatio || parseFloat(newRatio) <= 0) {
      toast.error("Please enter a valid price ratio");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch("/api/fiat/price-ratio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          usdtToPkr: parseFloat(newRatio),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update price ratio");
        return;
      }

      toast.success("Price ratio updated successfully");
      setPriceRatio(data.ratio);
      setNewRatio(data.ratio.usdtToPkr.toString());
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update price ratio");
    } finally {
      setUpdating(false);
    }
  };

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <p className="text-gray-300 mb-4">
                Please connect your wallet to access the admin panel
              </p>
              <Button
                onClick={() => navigate("/")}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600"
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <p className="text-gray-300 mb-2">Access Denied</p>
              <p className="text-sm text-gray-400 mb-4">
                Your wallet is not authorized to access the admin panel.
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Connected: {publicKey.toString().slice(0, 8)}...
              </p>
              <Button
                onClick={() => navigate("/")}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600"
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white">
      <div className="w-full max-w-lg mx-auto px-4 py-4 relative z-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate("/fiat")}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            BACK
          </Button>
          <h1 className="text-2xl font-bold text-white uppercase">
            Admin Panel
          </h1>
          <div className="w-10" />
        </div>

        {/* Authorization Badge */}
        <Card className="mb-6 bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <p className="text-sm font-medium">Admin Authorized</p>
            </div>
            <p className="text-xs text-gray-400">
              {wallet}
            </p>
          </CardContent>
        </Card>

        {/* Price Ratio Management */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Loading price ratio...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Current Exchange Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {priceRatio && (
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                      <p className="text-gray-400 text-sm mb-2">USDT to PKR</p>
                      <p className="text-2xl font-bold text-blue-400">
                        1 USDT = {priceRatio.usdtToPkr} PKR
                      </p>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                      <p className="text-gray-400 text-sm mb-2">PKR to USDT</p>
                      <p className="text-2xl font-bold text-purple-400">
                        1 PKR = {priceRatio.pkrToUsdt.toFixed(6)} USDT
                      </p>
                    </div>
                    <div className="pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">
                        Last Updated: {new Date(priceRatio.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Updated By: {priceRatio.updatedBy}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Update Exchange Rate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    New USDT to PKR Rate
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newRatio}
                      onChange={(e) => setNewRatio(e.target.value)}
                      placeholder="Enter new rate (e.g., 277)"
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Example: 277 means 1 USDT = 277 PKR
                  </p>
                </div>

                {newRatio && priceRatio && (
                  <div className="p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-400 mb-2">Preview:</p>
                    <p className="text-sm">
                      <span className="text-white">1 USDT = {parseFloat(newRatio)} PKR</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-400">
                        1 PKR = {(1 / parseFloat(newRatio)).toFixed(6)} USDT
                      </span>
                    </p>
                    {newRatio !== priceRatio.usdtToPkr.toString() && (
                      <p className="text-xs text-yellow-400 mt-2">
                        Change: {((parseFloat(newRatio) - priceRatio.usdtToPkr) / priceRatio.usdtToPkr * 100).toFixed(2)}%
                      </p>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleUpdateRatio}
                  disabled={updating || !newRatio}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Update Rate"}
                </Button>
              </CardContent>
            </Card>

            {/* Admin Help */}
            <Card className="mt-6 bg-blue-600/10 border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-sm">Admin Information</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-300 space-y-2">
                <p>
                  • This panel allows you to manually set the USDT/PKR exchange rate
                </p>
                <p>
                  • Changes will be applied immediately to all users
                </p>
                <p>
                  • Keep rates competitive with market conditions
                </p>
                <p>
                  • Only authorized admin wallets can access this panel
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
