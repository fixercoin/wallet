import { Buffer } from "buffer";
import process from "process";

(window as any).global = globalThis;
(window as any).Buffer = Buffer;
(window as any).process = process;

import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { ExpressP2PProvider } from "@/contexts/ExpressP2PContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ThemeProvider } from "next-themes";
import MobileShell from "@/components/ui/MobileShell";
import ViewModeToggle from "@/components/ui/ViewModeToggle";
import Index from "./pages/Index";
import FixoriumAdd from "./pages/FixoriumAdd";
import CreateToken from "./pages/CreateToken";
import TokenListing from "./pages/TokenListing";
import NotFound from "./pages/NotFound";
import OrderBook from "./pages/OrderBook";
import BuyTrade from "./pages/BuyTrade";
import ExpressPay from "./pages/ExpressPay";
import ExpressAddPost from "./pages/ExpressAddPost";
import ExpressOrderComplete from "./pages/ExpressOrderComplete";
import ExpressPendingOrders from "./pages/ExpressPendingOrders";
import ExpressPostOrderDetail from "./pages/ExpressPostOrderDetail";
import ExpressPostView from "./pages/ExpressPostView";
import ExpressStartTrade from "./pages/ExpressStartTrade";
import BuyCrypto from "./pages/BuyCrypto";
import BuyNote from "./pages/BuyNote";
import SellNote from "./pages/SellNote";
import VerifySell from "./pages/VerifySell";
import OrdersList from "./pages/OrdersList";
import OrderDetail from "./pages/OrderDetail";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/buy-crypto" element={<BuyCrypto />} />
      <Route path="/buynote" element={<BuyNote />} />
      <Route path="/sellnote" element={<SellNote />} />
      <Route path="/verify-sell" element={<VerifySell />} />
      <Route path="/orders/:status" element={<OrdersList />} />
      <Route path="/order/:orderId" element={<OrderDetail />} />
      <Route path="/fixorium/add" element={<FixoriumAdd />} />
      <Route path="/fixorium/create-token" element={<CreateToken />} />
      <Route path="/fixorium/token-listing" element={<TokenListing />} />
      <Route path="/express/orderbook" element={<OrderBook />} />
      <Route path="/express/buy-trade" element={<BuyTrade />} />
      <Route path="/express/pay" element={<ExpressPay />} />
      <Route path="/express/add-post" element={<ExpressAddPost />} />
      <Route
        path="/express/order-complete"
        element={<ExpressOrderComplete />}
      />
      <Route
        path="/express/pending-orders"
        element={<ExpressPendingOrders />}
      />
      <Route
        path="/express/post-order/:orderId"
        element={<ExpressPostOrderDetail />}
      />
      <Route path="/express/post-order" element={<ExpressAddPost />} />
      <Route path="/express/post/:orderId" element={<ExpressPostView />} />
      <Route path="/express/start-trade" element={<ExpressStartTrade />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  const [mode, setMode] = useState<"auto" | "mobile" | "full">(() => {
    try {
      return (localStorage.getItem("viewMode") as "auto" | "mobile" | "full") || "auto";
    } catch (_) {
      return "auto";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("viewMode", mode);
    } catch (_) {}
  }, [mode]);

  const [isMobileMatch, setIsMobileMatch] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false,
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

  const isMobilePreferred = mode === "mobile" ? true : mode === "full" ? false : isMobileMatch;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <ExpressP2PProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <CurrencyProvider>
                <BrowserRouter>
                  {isMobilePreferred ? (
                    <MobileShell>
                      <AppRoutes />
                    </MobileShell>
                  ) : (
                    <div className="min-h-screen">
                      <AppRoutes />
                    </div>
                  )}
                </BrowserRouter>
                <ViewModeToggle mode={mode} setMode={setMode} />
              </CurrencyProvider>
            </TooltipProvider>
          </ExpressP2PProvider>
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
