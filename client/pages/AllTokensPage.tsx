import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { TokenCard } from "@/components/wallet/TokenCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AllTokensPage() {
  const navigate = useNavigate();
  const { wallet, tokens } = useWallet();
  const [fixoriumTokens, setFixoriumTokens] = useState<any[]>([]);
  const [isLoadingFixorium, setIsLoadingFixorium] = useState(false);
  const [activeTab, setActiveTab] = useState<"my-tokens" | "all-tokens">(
    "my-tokens",
  );

  useEffect(() => {
    if (!wallet) {
      navigate("/");
    }
  }, [wallet, navigate]);

  useEffect(() => {
    if (activeTab === "all-tokens") {
      loadFixoriumTokens();
    }
  }, [activeTab]);

  const loadFixoriumTokens = async () => {
    setIsLoadingFixorium(true);
    try {
      const response = await fetch("/api/fixorium-tokens");
      if (response.ok) {
        const data = await response.json();
        setFixoriumTokens(data.tokens || []);
      }
    } catch (error) {
      console.error("Failed to load Fixorium tokens:", error);
    } finally {
      setIsLoadingFixorium(false);
    }
  };

  const handleTokenClick = (mint: string) => {
    navigate(`/token/${mint}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-sm bg-[#0f1520]/50 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Tokens</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as any)}
        >
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border border-white/20">
            <TabsTrigger
              value="my-tokens"
              className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white"
            >
              My Tokens
            </TabsTrigger>
            <TabsTrigger
              value="all-tokens"
              className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white"
            >
              All Tokens
            </TabsTrigger>
          </TabsList>

          {/* My Tokens Tab */}
          <TabsContent value="my-tokens" className="space-y-4 mt-6">
            {tokens && tokens.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tokens.map((token) => (
                  <TokenCard
                    key={token.mint}
                    token={token}
                    onClick={() => handleTokenClick(token.mint)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg">No tokens in your wallet</p>
                <p className="text-sm mt-2">
                  Create or import tokens to get started
                </p>
              </div>
            )}
          </TabsContent>

          {/* All Tokens Tab */}
          <TabsContent value="all-tokens" className="space-y-4 mt-6">
            {isLoadingFixorium ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : fixoriumTokens.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fixoriumTokens.map((token) => (
                  <TokenCard
                    key={token.mint}
                    token={token}
                    onClick={() => handleTokenClick(token.mint)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg">No tokens deployed yet</p>
                <p className="text-sm mt-2">Check back later for more tokens</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Back to Dashboard Button */}
        <div className="mt-8">
          <Button
            onClick={() => navigate("/")}
            className="w-full h-12 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white font-semibold rounded-lg"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
