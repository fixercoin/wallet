import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ShoppingCart, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import {
  PaymentMethod,
  getPaymentMethodsByWallet,
} from "@/lib/p2p-payment-methods";

interface TokenOption {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  mint?: string;
  price?: number;
}

const SUPPORTED_TOKEN_MINTS: Record<string, string> = {
  FIXERCOIN: TOKEN_MINTS.FIXERCOIN,
  SOL: TOKEN_MINTS.SOL,
  USDC: TOKEN_MINTS.USDC,
  USDT: TOKEN_MINTS.USDT,
};

const DEFAULT_TOKENS: TokenOption[] = [
  {
    id: "USDC",
    name: "USDC",
    symbol: "USDC",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    mint: SUPPORTED_TOKEN_MINTS.USDC,
  },
];

export default function SellNow() {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet, tokens: walletTokens = [] } = useWallet();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<TokenOption[]>(DEFAULT_TOKENS);
  const [selectedToken, setSelectedToken] = useState<TokenOption>(
    DEFAULT_TOKENS[0],
  );
  const [minAmountPKR, setMinAmountPKR] = useState<string>("");
  const [maxAmountPKR, setMaxAmountPKR] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [editingOrder, setEditingOrder] = useState<any>(
    (location.state as any)?.editingOrder || null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [fetchingPaymentMethod, setFetchingPaymentMethod] = useState(false);

  const OFFER_PASSWORD = "######Pakistan";

  const handleOfferAction = (action: "buy" | "sell") => {
    if (offerPassword !== OFFER_PASSWORD) {
      setPasswordError("Invalid password");
      return;
    }
    setShowCreateOfferDialog(false);
    setOfferPassword("");
    setPasswordError("");
    navigate(action === "buy" ? "/buy-crypto" : "/sell-now");
  };

  const [usdcDirectBalance, setUsdcDirectBalance] = useState<number | null>(
    null,
  );
  const [fetchingUsdcBalance, setFetchingUsdcBalance] = useState(false);

  // Direct USDC balance fetch via server API
  useEffect(() => {
    const fetchUsdcDirectBalance = async () => {
      if (!wallet?.publicKey) return;

      setFetchingUsdcBalance(true);
      try {
        const response = await fetch(
          `/api/wallet/token-balance?wallet=${encodeURIComponent(wallet.publicKey)}&mint=${encodeURIComponent(SUPPORTED_TOKEN_MINTS.USDC)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const balance = typeof data.balance === "number" ? data.balance : 0;
        setUsdcDirectBalance(balance);
        console.log("[SellNow] Server USDC balance fetched:", balance);
      } catch (err) {
        console.warn("[SellNow] Server USDC balance fetch failed:", err);
        setUsdcDirectBalance(0);
      } finally {
        setFetchingUsdcBalance(false);
      }
    };

    if (selectedToken.symbol === "USDC") {
      fetchUsdcDirectBalance();
    }
  }, [wallet?.publicKey, selectedToken.symbol]);

  const selectedTokenBalance = useMemo(() => {
    const t = (walletTokens || []).find(
      (tk) =>
        (tk.symbol || "").toUpperCase() === selectedToken.symbol.toUpperCase(),
    );
    const balance = t?.balance || 0;

    // For USDC, prioritize direct balance if available and valid
    if (selectedToken.symbol === "USDC" && usdcDirectBalance !== null) {
      // Use direct balance if it's more recent (non-zero or explicitly fetched)
      return usdcDirectBalance > 0 ? usdcDirectBalance : balance;
    }

    return balance;
  }, [walletTokens, selectedToken, usdcDirectBalance]);

  // Load editing order data if available
  useEffect(() => {
    if (editingOrder) {
      // Find the token from the order
      const token = tokens.find((t) => t.id === editingOrder.token);
      if (token) {
        setSelectedToken(token);
      }
      // Set the min/max amounts
      setMinAmountPKR(String(editingOrder.minAmountPKR || editingOrder.minAmountTokens || ""));
      setMaxAmountPKR(String(editingOrder.maxAmountPKR || editingOrder.maxAmountTokens || ""));
    }
  }, [editingOrder, tokens]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const mints = Object.values(SUPPORTED_TOKEN_MINTS);
        const dexTokens = await dexscreenerAPI.getTokensByMints(mints);
        const enriched = DEFAULT_TOKENS.map((token) => {
          const dexData = dexTokens.find(
            (dt) => dt.baseToken.address === token.mint,
          );
          return {
            ...token,
            logo: dexData?.info?.imageUrl || token.logo,
            price: dexData?.priceUsd ? parseFloat(dexData.priceUsd) : undefined,
          } as TokenOption;
        });
        setTokens(enriched);
        if (!editingOrder) {
          setSelectedToken(enriched[0]);
        }
      } catch (error) {
        console.warn("DexScreener fetch failed, using defaults", error);
        setTokens(DEFAULT_TOKENS);
      }
    };
    fetchTokens();
  }, []);

  useEffect(() => {
    const fetchRate = async () => {
      setFetchingRate(true);
      try {
        const url = `/api/token/price?token=${selectedToken.id}`;
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Rate fetch failed ${response.status}`);
        const data = await response.json();
        const rate = data.rate || data.priceInPKR || 0;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 0);
      } catch (error) {
        console.error("Exchange rate error:", error);
        setExchangeRate(0);
      } finally {
        setFetchingRate(false);
      }
    };
    fetchRate();
  }, [selectedToken]);

  useEffect(() => {
    const fetchPaymentMethod = async () => {
      if (!wallet?.publicKey) {
        setPaymentMethod(null);
        return;
      }

      setFetchingPaymentMethod(true);
      try {
        const methods = await getPaymentMethodsByWallet(wallet.publicKey);
        if (methods.length > 0) {
          setPaymentMethod(methods[0]);
        } else {
          setPaymentMethod(null);
        }
      } catch (error) {
        console.error("Error fetching payment method:", error);
        setPaymentMethod(null);
      } finally {
        setFetchingPaymentMethod(false);
      }
    };

    fetchPaymentMethod();
  }, [wallet?.publicKey]);

  const saveOrderToAPI = async (order: any) => {
    try {
      const response = await fetch("/api/p2p/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SELL",
          walletAddress: wallet.publicKey,
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
          minAmountPKR: order.minAmountPKR,
          maxAmountPKR: order.maxAmountPKR,
          pricePKRPerQuote: order.pricePKRPerQuote,
          paymentMethodId: order.paymentMethod,
          status: "PENDING",
          orderId: order.id,
          sellerWallet: wallet.publicKey,
        }),
      });

      if (!response.ok) {
        console.error(
          "Failed to save order to API:",
          response.status,
          await response.text(),
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error saving order to API:", error);
      return false;
    }
  };

  const handleSellClick = async () => {
    if (!wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please add a payment method first",
        variant: "destructive",
      });
      setShowPaymentDialog(true);
      return;
    }

    const minAmount = Number(minAmountPKR);
    const maxAmount = Number(maxAmountPKR);

    if (!minAmountPKR || !isFinite(minAmount) || minAmount <= 0) {
      toast({
        title: "Invalid Minimum Amount",
        description: "Enter a valid minimum USDC amount",
        variant: "destructive",
      });
      return;
    }

    if (!maxAmountPKR || !isFinite(maxAmount) || maxAmount <= 0) {
      toast({
        title: "Invalid Maximum Amount",
        description: "Enter a valid maximum USDC amount",
        variant: "destructive",
      });
      return;
    }

    if (minAmount >= maxAmount) {
      toast({
        title: "Invalid Range",
        description: "Maximum amount must be greater than minimum amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const orderId = editingOrder?.id || `SELL-${Date.now()}`;
      const order = {
        id: orderId,
        type: "SELL",
        token: selectedToken.id,
        minAmountPKR: minAmount,
        maxAmountPKR: maxAmount,
        pricePKRPerQuote: exchangeRate,
        paymentMethod: paymentMethod.id,
        sellerWallet: wallet.publicKey,
        walletAddress: wallet.publicKey,
        createdAt: editingOrder?.createdAt || Date.now(),
        updatedAt: Date.now(),
        status: "PENDING",
      };

      const saved = await saveOrderToAPI(order);
      if (!saved) {
        throw new Error("Failed to save order to the server");
      }

      toast({
        title: "Success",
        description: editingOrder
          ? "Sell order updated successfully"
          : "Sell order created successfully",
        duration: 2000,
      });

      navigate("/sell-order");
    } catch (error: any) {
      toast({
        title: "Failed to save order",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <Card className="bg-transparent backdrop-blur-xl rounded-md">
          <CardContent className="space-y-6 pt-6">
            <div className="p-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
              <div className="text-xs opacity-80 uppercase">
                AVAILABLE BALANCE
              </div>
              <div className="mt-1 text-sm">
                <span className="font-semibold flex items-center gap-2">
                  {fetchingUsdcBalance && selectedToken.symbol === "USDC" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      {selectedTokenBalance.toFixed(6)} {selectedToken.symbol}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-2 uppercase">
                MINIMUM AMOUNT (USDC)
              </label>
              <input
                type="number"
                value={minAmountPKR}
                onChange={(e) => setMinAmountPKR(e.target.value)}
                placeholder="Enter minimum amount in PKR"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                min="0"
                step="0.000001"
              />
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-2 uppercase">
                MAXIMUM AMOUNT (USDC)
              </label>
              <input
                type="number"
                value={maxAmountPKR}
                onChange={(e) => setMaxAmountPKR(e.target.value)}
                placeholder="Enter maximum amount in PKR"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                min="0"
                step="0.000001"
              />
            </div>

            <Button
              onClick={handleSellClick}
              disabled={
                loading ||
                !minAmountPKR ||
                !maxAmountPKR ||
                Number(minAmountPKR) <= 0 ||
                Number(maxAmountPKR) <= 0 ||
                Number(minAmountUSDC) >= Number(maxAmountUSDC) ||
                !paymentMethod ||
                fetchingPaymentMethod
              }
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : fetchingPaymentMethod ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading Payment Method...
                </>
              ) : !paymentMethod ? (
                "ADD PAYMENT METHOD FIRST"
              ) : editingOrder ? (
                "UPDATE SELL ORDER"
              ) : (
                "SELL FOR PKR"
              )}
            </Button>

            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 border border-[#FF7A5C]/50 text-[#FF7A5C] hover:bg-[#FF7A5C]/10"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) {
            setEditingPaymentMethodId(undefined);
          }
        }}
        walletAddress={wallet?.publicKey || ""}
        paymentMethodId={editingPaymentMethodId}
        onSave={() => {
          setEditingPaymentMethodId(undefined);
        }}
      />

      {/* Create Offer Dialog */}
      <Dialog
        open={showCreateOfferDialog}
        onOpenChange={(open) => {
          setShowCreateOfferDialog(open);
          if (!open) {
            setOfferPassword("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              CREATE OFFER
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase">
              CHOOSE WHETHER YOU WANT TO BUY OR SELL CRYPTO
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 uppercase">
                Password
              </label>
              <input
                type="password"
                value={offerPassword}
                onChange={(e) => {
                  setOfferPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Enter password"
                className="w-full px-4 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/30 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gray-300/50"
              />
              {passwordError && (
                <p className="text-red-500 text-xs mt-1">{passwordError}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleOfferAction("buy")}
                className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 text-white font-semibold rounded-lg transition-all uppercase"
              >
                <ShoppingCart className="w-8 h-8" />
                <span>BUY CRYPTO</span>
              </Button>
              <Button
                onClick={() => handleOfferAction("sell")}
                className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600/20 to-green-600/10 border border-green-500/30 hover:border-green-500/50 text-white font-semibold rounded-lg transition-all uppercase"
              >
                <TrendingUp className="w-8 h-8" />
                <span>SELL CRYPTO</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {
          setEditingPaymentMethodId(undefined);
          setShowPaymentDialog(true);
        }}
        onCreateOfferClick={() => setShowCreateOfferDialog(true)}
      />
    </div>
  );
}
