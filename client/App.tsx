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
import ExpressAddPost from "./pages/ExpressAddPost";
import ExpressPostView from "./pages/ExpressPostView";
import ExpressStartTrade from "./pages/ExpressStartTrade";
import ExpressPostOrderDetail from "./pages/ExpressPostOrderDetail";
import ExpressP2P from "./components/wallet/ExpressP2P";
import ExpressOrderComplete from "./pages/ExpressOrderComplete";
import ExpressPendingOrders from "./pages/ExpressPendingOrders";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function PendingOrderMinBar() {
  const [data, setData] = useState<any | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("expressPendingOrder");
        setData(raw ? JSON.parse(raw) : null);
      } catch {
        setData(null);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "expressPendingOrder") read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  if (!data || !data.minimized) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-yellow-50 border-b border-yellow-200 px-3 py-2 text-xs">
      <div className="font-medium">Pending Order</div>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-[hsl(var(--border))] bg-white px-2 py-1"
          onClick={() => {
            try {
              const next = {
                ...(data || {}),
                minimized: false,
                ts: Date.now(),
              };
              localStorage.setItem("expressPendingOrder", JSON.stringify(next));
            } catch {}
            navigate("/express/start-trade", {
              state: { ...(data?.params || {}), tradeId: data?.tradeId },
            });
          }}
        >
          Resume
        </button>
        <button
          className="rounded-md px-2 py-1"
          onClick={() => {
            try {
              localStorage.removeItem("expressPendingOrder");
            } catch {}
            setData(null);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PendingOrderMinBar />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/fixorium/add" element={<FixoriumAdd />} />
              <Route path="/fixorium/create-token" element={<CreateToken />} />
              <Route path="/express/add-post" element={<ExpressAddPost />} />
              <Route path="/express" element={<ExpressP2P />} />
              <Route
                path="/express/pending"
                element={<ExpressPendingOrders />}
              />
              <Route
                path="/express/start-trade"
                element={<ExpressStartTrade />}
              />
              <Route
                path="/express/order-complete"
                element={<ExpressOrderComplete />}
              />
              <Route path="/express/post" element={<ExpressPostView />} />
              <Route
                path="/express/post-order-detail"
                element={<ExpressPostOrderDetail />}
              />
              <Route
                path="/fixorium/token-listing"
                element={<TokenListing />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  console.error("React render error:", err);
  throw err;
}
