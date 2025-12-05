import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, X, AlertCircle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { ADMIN_WALLET } from "@/lib/p2p";
import { getOpenDisputes, resolveDispute, Dispute } from "@/lib/p2p-disputes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminDisputes() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolutionType, setResolutionType] = useState<
    "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT"
  >("RELEASE_TO_SELLER");
  const [resolving, setResolving] = useState(false);

  // Check admin access
  if (wallet?.publicKey !== ADMIN_WALLET) {
    return (
      <div
        className="w-full min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#1a1a1a", color: "#fff" }}
      >
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-lg font-semibold">Access Denied</p>
          <p className="text-sm text-gray-400 mt-2">
            Only admins can access this page
          </p>
          <Button
            onClick={() => navigate("/")}
            className="mt-4 bg-purple-600 hover:bg-purple-700"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadDisputes = async () => {
      try {
        setLoading(true);
        const data = await getOpenDisputes();
        setDisputes(data);
      } catch (error) {
        console.error("Error loading disputes:", error);
        toast.error("Failed to load disputes");
      } finally {
        setLoading(false);
      }
    };

    loadDisputes();
  }, []);

  const handleResolve = async () => {
    if (!selectedDispute || !wallet?.publicKey) return;

    try {
      setResolving(true);
      await resolveDispute(
        selectedDispute.id,
        resolutionType,
        wallet.publicKey,
      );
      toast.success("Dispute resolved successfully");
      setShowResolutionDialog(false);
      setSelectedDispute(null);

      // Refresh disputes
      const updated = await getOpenDisputes();
      setDisputes(updated);
    } catch (error) {
      console.error("Error resolving dispute:", error);
      toast.error("Failed to resolve dispute");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className="w-full min-h-screen pb-32"
      style={{ fontSize: "10px", backgroundColor: "#1a1a1a", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <button
          onClick={() => navigate("/")}
          className="text-gray-300 hover:text-gray-100 transition-colors mb-4"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg uppercase">
          Dispute Resolution
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {disputes.length} open dispute{disputes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {loading && (
          <div className="text-center text-gray-400 py-8">
            Loading disputes...
          </div>
        )}

        {!loading && disputes.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>No open disputes</p>
          </div>
        )}

        {disputes.map((dispute) => (
          <Card
            key={dispute.id}
            className="bg-transparent border border-gray-300/30 hover:border-gray-300/50 transition-colors mb-4 cursor-pointer"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-white text-sm uppercase">
                    Dispute #{dispute.id.split("_")[0]}
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-1">
                    Order: {dispute.orderId.substring(0, 16)}...
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold">
                  OPEN
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Reason</p>
                <p className="text-sm text-white">{dispute.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Initiated By</p>
                  <p className="text-xs text-gray-200 font-mono">
                    {dispute.initiatedBy.substring(0, 12)}...
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Created</p>
                  <p className="text-xs text-gray-200">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {dispute.evidence.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Evidence</p>
                  <div className="space-y-1">
                    {dispute.evidence.map((item, idx) => (
                      <p key={idx} className="text-xs text-gray-300 break-all">
                        • {item}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedDispute(dispute);
                  setShowResolutionDialog(true);
                }}
                className="w-full mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold uppercase transition-colors"
              >
                Resolve Dispute
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resolution Dialog */}
      <Dialog
        open={showResolutionDialog}
        onOpenChange={(open) => {
          setShowResolutionDialog(open);
          if (!open) {
            setSelectedDispute(null);
          }
        }}
      >
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              Resolve Dispute
            </DialogTitle>
            <DialogDescription className="text-gray-400 uppercase">
              Choose how to resolve this dispute
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Dispute ID</p>
                <p className="text-sm font-mono text-gray-200">
                  {selectedDispute.id.substring(0, 20)}...
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-300">
                  Resolution
                </p>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="resolution"
                    value="RELEASE_TO_SELLER"
                    checked={resolutionType === "RELEASE_TO_SELLER"}
                    onChange={(e) =>
                      setResolutionType(
                        e.target.value as
                          | "RELEASE_TO_SELLER"
                          | "REFUND_TO_BUYER"
                          | "SPLIT",
                      )
                    }
                    className="w-4 h-4 accent-purple-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Release to Seller
                    </p>
                    <p className="text-xs text-gray-400">Seller gets funds</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="resolution"
                    value="REFUND_TO_BUYER"
                    checked={resolutionType === "REFUND_TO_BUYER"}
                    onChange={(e) =>
                      setResolutionType(
                        e.target.value as
                          | "RELEASE_TO_SELLER"
                          | "REFUND_TO_BUYER"
                          | "SPLIT",
                      )
                    }
                    className="w-4 h-4 accent-purple-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Refund to Buyer
                    </p>
                    <p className="text-xs text-gray-400">Buyer gets refund</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="resolution"
                    value="SPLIT"
                    checked={resolutionType === "SPLIT"}
                    onChange={(e) =>
                      setResolutionType(
                        e.target.value as
                          | "RELEASE_TO_SELLER"
                          | "REFUND_TO_BUYER"
                          | "SPLIT",
                      )
                    }
                    className="w-4 h-4 accent-purple-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Split 50/50
                    </p>
                    <p className="text-xs text-gray-400">
                      Both parties get half
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button
                  onClick={() => setShowResolutionDialog(false)}
                  variant="outline"
                  className="border border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {resolving ? "Resolving..." : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
