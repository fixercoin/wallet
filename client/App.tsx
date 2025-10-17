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
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import FixoriumAdd from "./pages/FixoriumAdd";
import CreateToken from "./pages/CreateToken";
import TokenListing from "./pages/TokenListing";
import NotFound from "./pages/NotFound";
import OrderBook from "./pages/OrderBook";
import BuyTrade from "./pages/BuyTrade";
import ExpressPay from "./pages/ExpressPay";
import ExpressAddPost from "./pages/ExpressAddPost";
import ExpressEmbed from "./pages/ExpressEmbed";
import ExpressOrderComplete from "./pages/ExpressOrderComplete";
import ExpressPendingOrders from "./pages/ExpressPendingOrders";
import ExpressPostOrderDetail from "./pages/ExpressPostOrderDetail";
import ExpressPostView from "./pages/ExpressPostView";
import ExpressStartTrade from "./pages/ExpressStartTrade";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/fixorium/add" element={<FixoriumAdd />} />
      <Route path="/fixorium/create-token" element={<CreateToken />} />
      <Route path="/fixorium/token-listing" element={<TokenListing />} />
      <Route path="/express/orderbook" element={<OrderBook />} />
      <Route path="/express/buy-trade" element={<BuyTrade />} />
      <Route path="/express/pay" element={<ExpressPay />} />
      <Route path="/express/add-post" element={<ExpressAddPost />} />
      <Route path="/express/embedded" element={<ExpressEmbed />} />
      <Route path="/express/order-complete" element={<ExpressOrderComplete />} />
      <Route path="/express/pending-orders" element={<ExpressPendingOrders />} />
      <Route path="/express/post-order/:orderId" element={<ExpressPostOrderDetail />} />
      <Route path="/express/post-order" element={<ExpressAddPost />} />
      <Route path="/express/post/:orderId" element={<ExpressPostView />} />
      <Route path="/express/start-trade" element={<ExpressStartTrade />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
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
