import { useLocation, useNavigate } from "react-router-dom";

export default function ExpressOrderComplete() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const params = (state as any)?.params || null;
  const tradeId = (state as any)?.tradeId || null;
  const doneTs = (state as any)?.ts || Date.now();

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4"></div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-8">
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-lg font-semibold">Order Completed</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Your trade has been confirmed.
            </div>
            <div className="mt-4 space-y-1 text-sm">
              {tradeId && (
                <div className="flex justify-between">
                  <span>Trade ID</span>
                  <span className="font-mono text-xs">{tradeId}</span>
                </div>
              )}
              {params?.side && (
                <div className="flex justify-between">
                  <span>Side</span>
                  <span>{params.side}</span>
                </div>
              )}
              {params?.token && (
                <div className="flex justify-between">
                  <span>Token</span>
                  <span>{params.token}</span>
                </div>
              )}
              {typeof params?.tokenUnits === "number" && (
                <div className="flex justify-between">
                  <span>Units</span>
                  <span>{params.tokenUnits.toFixed(4)}</span>
                </div>
              )}
              {typeof params?.pkrAmount === "number" && (
                <div className="flex justify-between">
                  <span>PKR</span>
                  <span>{params.pkrAmount.toFixed(2)}</span>
                </div>
              )}
              {params?.paymentMethod && (
                <div className="flex justify-between">
                  <span>Method</span>
                  <span>{String(params.paymentMethod).toUpperCase()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Completed</span>
                <span>{new Date(doneTs).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                className="h-9 rounded-md bg-wallet-purple-500 px-4 py-2 text-white hover:bg-wallet-purple-600"
                onClick={() => navigate("/express")}
              >
                Back to Express
              </button>
              <button
                className="h-9 rounded-md border px-4 py-2"
                onClick={() => navigate("/")}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
