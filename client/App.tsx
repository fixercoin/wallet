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
import P2PActiveOrders from "./pages/P2PActiveOrders";
import BuyOrder from "./pages/BuyOrder";
import SellOrder from "./pages/SellOrder";
import BuyData from "./pages/BuyData";
import SellData from "./pages/SellData";
import AdminDisputes from "./pages/AdminDisputes";
import WaitingForSellerResponse from "./pages/WaitingForSellerResponse";
import WaitingForBuyerResponse from "./pages/WaitingForBuyerResponse";
import SellerOrderConfirmation from "./pages/SellerOrderConfirmation";
import { useLocation } from "react-router-dom";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/swap" element={<SwapPage />} />
      <Route path="/select" element={<Select />} />
      <Route path="/sell-now" element={<SellNow />} />
      <Route path="/buy-crypto" element={<BuyCrypto />} />
      <Route path="/buy-order" element={<BuyOrder />} />
      <Route path="/buydata" element={<BuyData />} />
      <Route path="/sell-order" element={<SellOrder />} />
      <Route path="/selldata" element={<SellData />} />
      <Route path="/buynote" element={<BuyNote />} />
      <Route path="/sellnote" element={<SellNote />} />
      <Route path="/verify-sell" element={<VerifySell />} />
      <Route path="/orders/:status" element={<OrdersList />} />
      <Route path="/order/:orderId" element={<OrderDetail />} />
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
      <Route path="/p2p/buy-active-orders" element={<P2PActiveOrders />} />
      <Route path="/p2p/sell-active-orders" element={<P2PActiveOrders />} />
      <Route path="/p2p/active-orders" element={<P2PActiveOrders />} />
      <Route path="/p2p/admin-disputes" element={<AdminDisputes />} />
      <Route path="/express/buy-trade" element={<BuyTrade />} />
      <Route
        path="/waiting-for-seller-response"
        element={<WaitingForSellerResponse />}
      />
      <Route
        path="/waiting-for-buyer-response"
        element={<WaitingForBuyerResponse />}
      />
      <Route
        path="/seller-order-confirmation/:orderId"
        element={<SellerOrderConfirmation />}
      />
      <Route path="/search" element={<TokenSearchPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppContent() {
  const location = useLocation();

  // Check if current route is a P2P page
  const isP2PPage = () => {
    const path = location.pathname;
    const p2pRoutes = [
      "/p2p",
      "/p2p/buy-active-orders",
      "/p2p/sell-active-orders",
      "/p2p/admin-disputes",
      "/express/buy-trade",
      "/sell-now",
      "/buynote",
      "/sellnote",
      "/verify-sell",
      "/waiting-for-seller-response",
      "/waiting-for-buyer-response",
      "/seller-order-confirmation",
      "/orders/",
      "/order/",
      "/buy-order",
      "/buydata",
      "/sell-order",
      "/selldata",
    ];

    return p2pRoutes.some((route) => path.startsWith(route));
  };

  return (
    <div className="min-h-screen pb-4">
      {isP2PPage() && (
        <div className="fixed top-4 right-4 z-40">
          <NotificationCenter />
        </div>
      )}
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
  }, [initPushNotifications]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
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
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
