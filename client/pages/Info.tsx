import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy } from "lucide-react";
import { useState } from "react";

export default function Info() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const fixerCoinData = {
    name: "FIXERCOIN",
    ticker: "FIXERCOIN",
    contractAddress: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    totalSupply: "970,000,000",
    buySupply: "80%",
    remainingSupply: "20%",
    tradingPlatforms: [
      "FIXORIUM WALLET",
      "BITSROAGE FINANCE EXCHANGE",
      "DEX-TRADE CRYPTO EXCHANGE",
    ],
    webWallets: ["FIXORIUM", "METAMASK", "PHANTOM"],
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fixerCoinData.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-2xl mx-auto px-4 py-8 relative z-20">
        <Card className="bg-card border border-border rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            {/* Back Button */}
            <div className="flex justify-start mb-6">
              <Button
                onClick={() => navigate("/")}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary p-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </div>

            {/* Logo and Title */}
            <div className="flex flex-row items-center gap-4 mb-8">
              <div className="w-24 h-24 rounded-lg flex items-center justify-center border border-border overflow-hidden flex-shrink-0">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2F9918a7d4ac0d4f4cb858f57b2eb251de%2Fa25a3a5720954b6b98401743c4c4df16?format=webp&width=800"
                  alt="FixerCoin Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground uppercase">
                  {fixerCoinData.name}
                </h1>
                <p className="text-lg text-accent uppercase">
                  {fixerCoinData.ticker}
                </p>
              </div>
            </div>

            {/* Contract Address */}
            <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-[12px] text-muted-foreground mb-2 uppercase font-semibold">
                CONTRACT ADDRESS
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-mono text-foreground break-all uppercase">
                  {fixerCoinData.contractAddress}
                </p>
                <Button
                  onClick={copyToClipboard}
                  size="sm"
                  variant="ghost"
                  className="text-accent hover:text-accent/80 flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && (
                <p className="text-[12px] text-success-500 mt-2 uppercase">
                  ✓ COPIED
                </p>
              )}
            </div>

            {/* Supply Info */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-card/50 border border-border rounded-lg p-3 text-center">
                <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                  TOTAL SUPPLY
                </p>
                <p className="text-[12px] font-bold text-foreground uppercase">
                  {fixerCoinData.totalSupply}
                </p>
              </div>
              <div className="bg-card/50 border border-border rounded-lg p-3 text-center">
                <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                  BUY SUPPLY
                </p>
                <p className="text-[12px] font-bold text-wallet-success-500 uppercase">
                  {fixerCoinData.buySupply}
                </p>
              </div>
              <div className="bg-card/50 border border-border rounded-lg p-3 text-center">
                <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                  REMAINING
                </p>
                <p className="text-[12px] font-bold text-wallet-blue-500 uppercase">
                  {fixerCoinData.remainingSupply}
                </p>
              </div>
            </div>

            {/* Trading Platforms */}
            <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-[12px] text-muted-foreground mb-3 uppercase font-semibold">
                TRADING PLATFORMS
              </p>
              <div className="space-y-2">
                {fixerCoinData.tradingPlatforms.map((platform, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-[12px] text-foreground uppercase"
                  >
                    <span className="w-2 h-2 bg-primary rounded-full" />
                    {platform}
                  </div>
                ))}
              </div>
            </div>

            {/* Web3 Wallets */}
            <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-[12px] text-muted-foreground mb-3 uppercase font-semibold">
                AVAILABLE WALLETS
              </p>
              <div className="flex flex-wrap gap-2">
                {fixerCoinData.webWallets.map((wallet, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-card border border-border rounded-full text-[12px] font-semibold text-accent uppercase"
                  >
                    {wallet}
                  </span>
                ))}
              </div>
            </div>

            {/* Future Outlook */}
            <div className="bg-card/50 border border-border rounded-lg p-4">
              <p className="text-[12px] text-muted-foreground mb-4 uppercase font-semibold">
                FUTURE OUTLOOK
              </p>
              <div className="space-y-4">
                <div>
                  <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                    NEXT POSSIBLE RATE
                  </p>
                  <p className="text-[12px] font-bold text-wallet-success-500 uppercase">
                    $0.50 - $2.00 USD
                  </p>
                  <p className="text-[12px] text-foreground/80 mt-1 uppercase">
                    EXPECTED WITHIN 12-24 MONTHS BASED ON ECOSYSTEM DEVELOPMENT
                    AND MARKET ADOPTION
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                    TARGET PRICE
                  </p>
                  <p className="text-[12px] font-bold text-wallet-blue-500 uppercase">
                    $5.00+ USD
                  </p>
                  <p className="text-[12px] text-foreground/80 mt-1 uppercase">
                    LONG-TERM TARGET WITH FULL ECOSYSTEM INTEGRATION AND MAJOR
                    PARTNERSHIPS
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                    INVESTMENT OPPORTUNITIES
                  </p>
                  <p className="text-[12px] text-foreground uppercase">
                    EARLY-STAGE ADOPTION • LOW MARKET CAP • HIGH GROWTH
                    POTENTIAL • COMMUNITY REWARDS
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                    FIXORIUM WALLET INTEGRATION
                  </p>
                  <p className="text-[12px] text-accent font-semibold uppercase">
                    SEAMLESS STAKING, REWARDS, AND TRADING DIRECTLY IN FIXORIUM
                    WALLET
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[12px] text-muted-foreground mb-1 uppercase font-semibold">
                    CEX EXCHANGE LISTING
                  </p>
                  <p className="text-[12px] font-bold text-wallet-success-500 uppercase">
                    COMING Q2 2025
                  </p>
                  <p className="text-[12px] text-foreground/80 mt-1 uppercase">
                    MAJOR CENTRALIZED EXCHANGES LISTING PLANNED • INCREASED
                    LIQUIDITY AND ACCESSIBILITY
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
