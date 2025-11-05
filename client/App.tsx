import { Buffer } from "buffer";
import process from "process";

(window as any).global = globalThis;
(window as any).Buffer = Buffer;
(window as any).process = process;

// In Builder preview the Builder iframe may proxy analytics requests (Amplitude) through
// cdn.builder.codes which can hit rate limits (429) and cause the editor iframe to fail.
// Intercept those specific proxied amplitude requests when running inside a Builder preview
// so they return a harmless success and don't block iframe evaluation.
if (typeof window !== "undefined") {
  try {
    const isBuilderPreview =
      window.location.hostname.includes("projects.builder.my") ||
      window.location.hostname.endsWith("builder.my") ||
      window.location.search.includes("fusion=true") ||
      window.location.search.includes("builder.frameEditing");

    if (isBuilderPreview && window.fetch) {
      const originalFetch = window.fetch.bind(window);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.fetch = async (input: any, init?: any) => {
        try {
          const url = typeof input === "string" ? input : input?.url;
          if (
            typeof url === "string" &&
            url.includes("cdn.builder.codes/api/v1/proxy-api") &&
            url.includes("amplitude.com")
          ) {
            // Return a minimal OK response to stop repeated proxy calls causing 429s
            return new Response(JSON.stringify({ status: "skipped" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          // swallow
        }
        return originalFetch(input, init);
      };
    }
  } catch (e) {
    // ignore
  }
}

import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ThemeProvider } from "next-themes";
import MobileShell from "@/components/ui/MobileShell";
import Index from "./pages/Index";
import FixoriumAdd from "./pages/FixoriumAdd";
import CreateToken from "./pages/CreateToken";
import TokenListing from "./pages/TokenListing";
import WalletHistory from "./pages/WalletHistory";
import NotFound from "./pages/NotFound";
import BuyCrypto from "./pages/BuyCrypto";
import BuyNote from "./pages/BuyNote";
import SellNote from "./pages/SellNote";
import VerifySell from "./pages/VerifySell";
import OrdersList from "./pages/OrdersList";
import OrderDetail from "./pages/OrderDetail";
import Select from "./pages/select";
import BuyNow from "./pages/buy-now";
import SellNow from "./pages/sell-now";
import AdminBroadcast from "./pages/AdminBroadcast";
import SwapPage from "./pages/Swap";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/swap" element={<SwapPage />} />
      <Route path="/select" element={<Select />} />
      <Route path="/buy-now" element={<BuyNow />} />
      <Route path="/sell-now" element={<SellNow />} />
      <Route path="/buy-crypto" element={<BuyCrypto />} />
      <Route path="/buynote" element={<BuyNote />} />
      <Route path="/sellnote" element={<SellNote />} />
      <Route path="/verify-sell" element={<VerifySell />} />
      <Route path="/orders/:status" element={<OrdersList />} />
      <Route path="/order/:orderId" element={<OrderDetail />} />
      <Route path="/fixorium/add" element={<FixoriumAdd />} />
      <Route path="/fixorium/create-token" element={<CreateToken />} />
      <Route path="/fixorium/token-listing" element={<TokenListing />} />
      <Route path="/wallet/history" element={<WalletHistory />} />
      <Route path="/admin-broadcast" element={<AdminBroadcast />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  const [isMobileMatch, setIsMobileMatch] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 640px)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsMobileMatch(e.matches);
    try {
      mq.addEventListener("change", handler);
    } catch (e) {
      // Safari fallback
      // @ts-ignore
      mq.addListener(handler);
    }
    return () => {
      try {
        mq.removeEventListener("change", handler);
      } catch (e) {
        // @ts-ignore
        mq.removeListener(handler);
      }
    };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <CurrencyProvider>
              <BrowserRouter>
                {isMobileMatch ? (
                  <MobileShell>
                    <AppRoutes />
                  </MobileShell>
                ) : (
                  <div className="min-h-screen">
                    <AppRoutes />
                  </div>
                )}
              </BrowserRouter>
            </CurrencyProvider>
          </TooltipProvider>
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  console.error("React render error:", err);
  throw err;
}
