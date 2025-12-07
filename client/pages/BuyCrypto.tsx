import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart, TrendingUp } from "lucide-react";
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
  USDC: TOKEN_MINTS.USDC,
};

const DEFAULT_TOKENS: TokenOption[] = [
  {
    id: "USDC",
    name: "USDC",
    symbol: "USDC",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5Au7BXRSpJfDw3gEPrwwAau4vTNihtQ5go5Q/logo.png",
    mint: SUPPORTED_TOKEN_MINTS.USDC,
  },
];

export default function BuyCrypto() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get("edit");

  const [tokens, setTokens] = useState<TokenOption[]>(DEFAULT_TOKENS);
  const [selectedToken, setSelectedToken] = useState<TokenOption>(
    DEFAULT_TOKENS[0],
  );
  const [minAmountPKR, setMinAmountPKR] = useState<string>("");
  const [maxAmountPKR, setMaxAmountPKR] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [fetchingPaymentMethod, setFetchingPaymentMethod] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);

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

  const saveOrderToKV = async (order: any, isUpdate: boolean = false) => {
    try {
      const method = isUpdate ? "PUT" : "POST";
      const url = isUpdate
        ? `/api/p2p/orders/${editingOrder.id}`
        : "/api/p2p/orders";

      const orderPayload: any = {
        walletAddress: wallet.publicKey,
        type: order.type,
        token: order.token,
        minAmountPKR: order.minAmountPKR,
        maxAmountPKR: order.maxAmountPKR,
        pricePKRPerQuote: order.pricePKRPerQuote,
        paymentMethodId: order.paymentMethod,
        status: "PENDING",
      };

      // Only include amountTokens and amountPKR if provided
      if (order.amountTokens !== undefined) {
        orderPayload.amountTokens = order.amountTokens;
      }
      if (order.amountPKR !== undefined) {
        orderPayload.amountPKR = order.amountPKR;
      }

      // For edit operations
      if (isUpdate && editingOrder?.id) {
        orderPayload.orderId = editingOrder.id;
      }

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        console.error(
          `Failed to ${isUpdate ? "update" : "save"} order:`,
          response.status,
        );
        return false;
      }
      const data = await response.json();
      return data.order || data.data || data;
    } catch (error) {
      console.error(`Error ${isUpdate ? "updating" : "saving"} order:`, error);
      return false;
    }
  };

  // Load editing order if edit parameter exists
  useEffect(() => {
    const fetchEditingOrder = async () => {
      if (!editOrderId || !wallet?.publicKey) return;

      try {
        const response = await fetch(`/api/p2p/orders/${editOrderId}`);
        if (!response.ok) throw new Error("Failed to fetch order");

        const data = await response.json();
        const order = data.order || data;

        setEditingOrder(order);
        setMinAmountPKR(String(order.minAmountPKR || ""));
        setMaxAmountPKR(String(order.maxAmountPKR || ""));
      } catch (error) {
        console.error("Error fetching order:", error);
        toast({
          title: "Error",
          description: "Failed to load order data",
          variant: "destructive",
        });
      }
    };

    fetchEditingOrder();
  }, [editOrderId, wallet?.publicKey, toast]);

  // Load token logos/prices (best-effort)
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
        setSelectedToken(enriched[0]);
      } catch (error) {
        console.warn("DexScreener fetch failed, using defaults", error);
        setTokens(DEFAULT_TOKENS);
      }
    };
    fetchTokens();
  }, []);

  // Fetch PKR exchange rate for selected token (via backend proxy)
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

  // Fetch payment method from KV for the current wallet
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

  const handleBuyClick = async () => {
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

    if (!minAmountPKR || minAmount <= 0) {
      toast({
        title: "Invalid Minimum Amount",
        description: "Enter a valid minimum PKR amount",
        variant: "destructive",
      });
      return;
    }

    if (!maxAmountPKR || maxAmount <= 0) {
      toast({
        title: "Invalid Maximum Amount",
        description: "Enter a valid maximum PKR amount",
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

    const pricePKRPerQuote = exchangeRate;

    setLoading(true);
    try {
      const order = {
        type: "BUY",
        token: selectedToken.id,
        minAmountPKR: minAmount,
        maxAmountPKR: maxAmount,
        pricePKRPerQuote,
        paymentMethod: paymentMethod.id,
      };

      const isUpdate = !!editingOrder;
      const savedOrder = await saveOrderToKV(order, isUpdate);
      if (!savedOrder) {
        throw new Error(`Failed to ${isUpdate ? "update" : "save"} order`);
      }

      toast({
        title: "Success",
        description: `Buy order ${isUpdate ? "updated" : "created"} successfully`,
        duration: 2000,
      });

      navigate(isUpdate ? "/buy-data" : "/buy-order");
    } catch (error: any) {
      toast({
        title: `Failed to ${editingOrder ? "update" : "create"} order`,
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
            <div>
              <label className="block font-medium text-white/80 mb-3 uppercase">
                SELECT TOKEN
              </label>
              <Select
                value={selectedToken.id}
                onValueChange={(id) => {
                  const token = tokens.find((t) => t.id === id);
                  if (token) setSelectedToken(token);
                }}
              >
                <SelectTrigger className="bg-[#1a2540]/50 focus:ring-2 focus:ring-[#FF7A5C] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2540]">
                  {tokens.map((token) => (
                    <SelectItem
                      key={token.id}
                      value={token.id}
                      className="text-white"
                    >
                      {token.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-2 uppercase">
                MINIMUM AMOUNT PKR
              </label>
              <input
                type="number"
                value={minAmountPKR}
                onChange={(e) => setMinAmountPKR(e.target.value)}
                placeholder="Enter minimum amount in PKR"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                min="0"
                step="100"
              />
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-2 uppercase">
                MAXIMUM AMOUNT PKR
              </label>
              <input
                type="number"
                value={maxAmountPKR}
                onChange={(e) => setMaxAmountPKR(e.target.value)}
                placeholder="Enter maximum amount in PKR"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                min="0"
                step="100"
              />
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-2 uppercase">
                WALLET ADDRESS
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Paste your wallet address"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40 font-mono text-xs"
              />
            </div>

            <Button
              onClick={handleBuyClick}
              disabled={
                loading ||
                !minAmountPKR ||
                !maxAmountPKR ||
                Number(minAmountPKR) <= 0 ||
                Number(maxAmountPKR) <= 0 ||
                Number(minAmountPKR) >= Number(maxAmountPKR) ||
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
                `UPDATE BUY OFFER`
              ) : (
                `BUY CRYPTO`
              )}
            </Button>

            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 text-white"
            >
              BACK
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
