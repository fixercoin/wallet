import { Buffer } from "buffer";
import process from "process";

(window as any).global = globalThis;
(window as any).Buffer = Buffer;
(window as any).process = process;

// In Builder preview the Builder iframe may proxy analytics requests (Amplitude) through
// cdn.builder.codes which can hit rate limits (429) and cause the editor iframe to fail.
// Intercept those proxied requests when running inside a Builder preview so they return
// harmless responses and don't block iframe evaluation.
if (typeof window !== "undefined") {
  try {
    const isBuilderPreview =
      window.location.hostname.includes("projects.builder.my") ||
      window.location.hostname.endsWith("builder.my") ||
      window.location.search.includes("fusion=true") ||
      window.location.search.includes("builder.frameEditing");

    if (isBuilderPreview) {
      const blockedPatterns: string[] = [
        "cdn.builder.codes/api/v1/proxy-api",
        "cdn.builder.codes",
        "amplitude.com",
        "api2.amplitude.com",
        "builder.my/_next/static",
        "builder.my/assets",
      ];

      if (window.fetch) {
        const originalFetch = window.fetch.bind(window);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.fetch = async (input: any, init?: any) => {
          try {
            const url = typeof input === "string" ? input : input?.url;
            if (typeof url === "string") {
              for (const p of blockedPatterns) {
                if (url.includes(p)) {
                  return new Response(JSON.stringify({ status: "skipped" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                  });
                }
              }
            }
          } catch (e) {
            // swallow
          }
          return originalFetch(input, init);
        };
      }

      // Intercept XHR as well (some libs use XHR not fetch)
      if (typeof XMLHttpRequest !== "undefined") {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        // @ts-ignore
        XMLHttpRequest.prototype.open = function (method: string, url: string) {
          try {
            // @ts-ignore
            this._url = url;
          } catch (e) {}
          // @ts-ignore
          return origOpen.apply(this, arguments as any);
        };
        // @ts-ignore
        XMLHttpRequest.prototype.send = function (body?: any) {
          try {
            // @ts-ignore
            const url = this._url || "";
            for (const p of blockedPatterns) {
              if (url.includes(p)) {
                // emulate a successful XHR response
                setTimeout(() => {
                  try {
                    // @ts-ignore
                    this.readyState = 4;
                    // @ts-ignore
                    this.status = 200;
                    // @ts-ignore
                    this.responseText = JSON.stringify({ status: "skipped" });
                    if (typeof this.onload === "function") this.onload();
                    if (typeof this.onreadystatechange === "function")
                      this.onreadystatechange();
                  } catch (e) {}
                }, 0);
                return;
              }
            }
          } catch (e) {}
          // @ts-ignore
          return origSend.apply(this, arguments as any);
        };
      }
    }
  } catch (e) {
    // ignore
  }
}

import "./global.css";

import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { initStorageMonitoring } from "@/lib/storage-monitor";
import { usePushNotifications } from "@/lib/services/push-notifications";
import { syncAllOrdersFromLocalStorage } from "@/lib/p2p-order-api";
import Index from "./pages/Index";
import FixoriumAdd from "./pages/FixoriumAdd";
import CreateToken from "./pages/CreateToken";
import TokenListing from "./pages/TokenListing";
import WalletHistory from "./pages/WalletHistory";
import NotFound from "./pages/NotFound";
import BuyCrypto from "./pages/BuyCrypto";
import TokenSearchDetail from "./pages/TokenSearchDetail";
import BuyNote from "./pages/BuyNote";
import SellNote from "./pages/SellNote";
import VerifySell from "./pages/VerifySell";
import OrdersList from "./pages/OrdersList";
import OrderDetail from "./pages/OrderDetail";
import Select from "./pages/select";
import SellNow from "./pages/sell-now";
import AdminBroadcast from "./pages/AdminBroadcast";
import SwapPage from "./pages/Swap";
import AutoBot from "./pages/AutoBot";
import AirdropPage from "./pages/AirdropPage";
import DappsPage from "./pages/DappsPage";
import DappView from "./pages/DappView";
import DappVisit from "./pages/DappVisit";
import AssetsPage from "./pages/AssetsPage";
import DepositAssetPage from "./pages/DepositAssetPage";
import SelectLanguagePage from "./pages/SelectLanguagePage";
import SelectCurrencyPage from "./pages/SelectCurrencyPage";
import BurnTokenPage from "./pages/BurnTokenPage";
import RunningMarketMaker from "./pages/RunningMarketMaker";
import MarketMakerHistory from "./pages/MarketMakerHistory";
import { AppWithPasswordPrompt } from "@/components/AppWithPasswordPrompt";
import { NotificationCenter } from "@/components/NotificationCenter";
import DocumentationPage from "./pages/DocumentationPage";
import BuyTrade from "./pages/BuyTrade";
import TokenSearchPage from "./pages/TokenSearchPage";
import BuyData from "./pages/BuyData";
import SellData from "./pages/SellData";
import Market from "./pages/Market";
import BuyerOrderConfirmation from "./pages/BuyerOrderConfirmation";
import { useLocation } from "react-router-dom";
import { P2POrderFlowProvider } from "@/contexts/P2POrderFlowContext";
import FiatSystem from "./pages/FiatSystem";
import FiatTransactions from "./pages/FiatTransactions";
import FiatAdmin from "./pages/FiatAdmin";
import { SellerPaymentMethodDialog } from "@/components/p2p/SellerPaymentMethodDialog";
import { BuyerWalletAddressDialog } from "@/components/p2p/BuyerWalletAddressDialog";
import { SellerTransferDetailsDialog } from "@/components/p2p/SellerTransferDetailsDialog";
import { CryptoSentDialog } from "@/components/p2p/CryptoSentDialog";
import { CryptoReceivedDialog } from "@/components/p2p/CryptoReceivedDialog";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/swap" element={<SwapPage />} />
      <Route path="/select" element={<Select />} />
      <Route path="/sell-now" element={<SellNow />} />
      <Route path="/buy-crypto" element={<BuyCrypto />} />
      <Route path="/buydata" element={<BuyData />} />
      <Route path="/selldata" element={<SellData />} />
      <Route path="/marketplace" element={<Market />} />
      <Route path="/fiat" element={<FiatSystem />} />
      <Route path="/fiat/transactions" element={<FiatTransactions />} />
      <Route path="/fiat/admin" element={<FiatAdmin />} />
      <Route
        path="/buyer-order-confirmation"
        element={<BuyerOrderConfirmation />}
      />
      <Route path="/fixorium/add" element={<FixoriumAdd />} />
      <Route path="/fixorium/create-token" element={<CreateToken />} />
      <Route path="/fixorium/token-listing" element={<TokenListing />} />
      <Route path="/wallet/history" element={<WalletHistory />} />
      <Route path="/token/:mint" element={<TokenSearchDetail />} />
      <Route path="/admin-broadcast" element={<AdminBroadcast />} />
      <Route path="/autobot" element={<AutoBot />} />
      <Route path="/burn" element={<BurnTokenPage />} />
      <Route path="/airdrop" element={<AirdropPage />} />
      <Route path="/assets" element={<AssetsPage />} />
      <Route path="/assets/deposit" element={<DepositAssetPage />} />
      <Route path="/dapps" element={<DappsPage />} />
      <Route path="/dapps/visit" element={<DappVisit />} />
      <Route path="/dapps/view" element={<DappView />} />
      <Route path="/select-language" element={<SelectLanguagePage />} />
      <Route path="/select-currency" element={<SelectCurrencyPage />} />
      <Route
        path="/market-maker/running/:sessionId"
        element={<RunningMarketMaker />}
      />
      <Route path="/market-maker/history" element={<MarketMakerHistory />} />
      <Route
        path="/documentation"
        element={<DocumentationPage onBack={() => window.history.back()} />}
      />
      <Route path="/search" element={<TokenSearchPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function P2POrderFlowDialogs() {
  return (
    <>
      <SellerPaymentMethodDialog />
      <BuyerWalletAddressDialog />
      <SellerTransferDetailsDialog />
      <CryptoSentDialog />
      <CryptoReceivedDialog />
    </>
  );
}

function AppContent() {
  const location = useLocation();

  // Check if current route is a P2P page
  const isP2PPage = () => {
    const path = location.pathname;
    return (
      path.startsWith("/buydata") ||
      path.startsWith("/selldata") ||
      path.startsWith("/p2p") ||
      path.startsWith("/buy-crypto") ||
      path.startsWith("/sell-now") ||
      path.startsWith("/buy-order") ||
      path.startsWith("/sell-order") ||
      path.startsWith("/order") ||
      path.startsWith("/buy-trade") ||
      path.startsWith("/waiting-for-buyer") ||
      path.startsWith("/waiting-for-seller") ||
      path.startsWith("/order-complete") ||
      path.startsWith("/buyer-order-confirmation")
    );
  };

  return (
    <div className="min-h-screen pb-4">
      {isP2PPage() && (
        <div className="fixed top-4 right-4 z-40">
          <NotificationCenter />
        </div>
      )}
      {/* Only render P2P dialogs on P2P pages to avoid wallet dashboard interference */}
      {isP2PPage() && <P2POrderFlowDialogs />}
      <AppRoutes />
    </div>
  );
}

function App() {
  const { initPushNotifications } = usePushNotifications();

  // Initialize storage monitoring and push notifications on app start
  useEffect(() => {
    initStorageMonitoring();
    initPushNotifications().catch((error) => {
      console.warn("Failed to initialize push notifications:", error);
    });

    // Sync any orders from localStorage to KV storage on app startup
    syncAllOrdersFromLocalStorage()
      .then((result) => {
        if (result.synced > 0) {
          console.log(
            `[App Init] Synced ${result.synced}/${result.total} orders from localStorage to KV`,
          );
        }
      })
      .catch((error) => {
        console.warn("Failed to sync orders from localStorage:", error);
      });
  }, [initPushNotifications]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <P2POrderFlowProvider>
            <AppWithPasswordPrompt>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <LanguageProvider>
                  <CurrencyProvider>
                    <BrowserRouter>
                      <AppContent />
                    </BrowserRouter>
                  </CurrencyProvider>
                </LanguageProvider>
              </TooltipProvider>
            </AppWithPasswordPrompt>
          </P2POrderFlowProvider>
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
