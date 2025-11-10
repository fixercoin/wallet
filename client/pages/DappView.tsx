import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function DappView() {
  const q = useQuery();
  const url = q.get("url") || "";
  const { toast } = useToast();
  const navigate = useNavigate();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const loadTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!url) {
      navigate("/dapps");
      return;
    }

    if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = window.setTimeout(() => {
      if (!iframeLoaded) setIframeBlocked(true);
    }, 4000);

    return () => {
      if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
    };
  }, [url, navigate, iframeLoaded]);

  const handleOpenNewTab = () => {
    window.open(url, "_blank", "noopener");
  };

  const handleConnectFromView = async () => {
    setLoading(true);
    try {
      const provider = ensureFixoriumProvider();
      if (!provider) throw new Error("Provider unavailable");
      const res = await provider.connect();
      const pub = res?.publicKey?.toBase58 ? res.publicKey.toBase58() : String(res?.publicKey);
      toast({ title: "DApp Connected", description: `${pub}` });
    } catch (err: any) {
      toast({ title: "Connect Failed", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!url) return;
    const origin = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return "*";
      }
    })();

    const handler = async (ev: MessageEvent) => {
      try {
        if (!ev.data || typeof ev.data !== "object") return;
        const { type, requestId } = ev.data as any;

        if (type === "REQUEST_CONNECT") {
          if (origin !== "*" && ev.origin !== origin) return;

          const allow = window.confirm(`DApp at ${ev.origin} requests wallet connection. Allow?`);
          if (!allow) {
            ev.source?.postMessage?.({ type: "CONNECT_RESPONSE", success: false, error: "User rejected", requestId }, ev.origin);
            return;
          }

          try {
            const provider = ensureFixoriumProvider();
            if (!provider) throw new Error("Provider unavailable");
            const res = await provider.connect();
            const pub = res?.publicKey?.toBase58 ? res.publicKey.toBase58() : String(res?.publicKey);
            ev.source?.postMessage?.({ type: "CONNECT_RESPONSE", success: true, publicKey: pub, requestId }, ev.origin);
            toast({ title: "DApp Connected", description: `${pub}` });
          } catch (err: any) {
            ev.source?.postMessage?.({ type: "CONNECT_RESPONSE", success: false, error: err?.message || String(err), requestId }, ev.origin);
            toast({ title: "Connect Failed", description: err?.message || String(err), variant: "destructive" });
          }
        }

        if (type === "CHECK_EMBEDDED") {
          if (origin !== "*" && ev.origin !== origin) return;
          ev.source?.postMessage?.({ type: "EMBEDDED_OK" }, ev.origin);
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [url, toast]);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-transparent text-gray-700 flex items-center justify-center rounded-none border border-gray-200">
            <ExternalLink className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium">{(() => {
              try {
                return new URL(url).hostname;
              } catch {
                return url;
              }
            })()}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{url}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenNewTab} className="rounded-none bg-white/5 text-black">Open in new tab</Button>
          <Button onClick={() => navigate("/dapps")} variant="outline" className="rounded-none">Back</Button>
          <Button onClick={handleConnectFromView} className="rounded-none bg-green-600 text-white" disabled={loading}>
            {loading ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>
      </div>

      <Card className="rounded-none border border-gray-300/20">
        <CardContent className="p-0">
          <div style={{ minHeight: 600 }}>
            <iframe
              ref={iframeRef}
              src={url}
              title="DApp View"
              className="w-full h-[70vh]"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              onLoad={() => {
                setIframeLoaded(true);
                setIframeBlocked(false);
                if (loadTimeoutRef.current) {
                  window.clearTimeout(loadTimeoutRef.current);
                  loadTimeoutRef.current = null;
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
        {iframeBlocked ? (
          <>
            This site may block embedding (X-Frame-Options or CSP). Use "Open in new tab" to load it, or use the Connect Wallet button to connect directly.
          </>
        ) : (
          <>This page supports a postMessage handshake. The DApp can post {JSON.stringify({ type: "REQUEST_CONNECT" })} to request a wallet connection; the parent will reply with CONNECT_RESPONSE.</>
        )}
      </div>

      <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
        DApp snippet (for site developers):
        <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto rounded-none">{`// In the DApp page (iframe)
window.parent.postMessage({ type: 'REQUEST_CONNECT', requestId: 'r1' }, '*');

window.addEventListener('message', (ev) => {
  if (ev.data?.type === 'CONNECT_RESPONSE' && ev.data.requestId === 'r1') {
    if (ev.data.success) {
      console.log('Connected publicKey', ev.data.publicKey);
    } else {
      console.error('Connect failed', ev.data.error);
    }
  }
});`}</pre>
      </div>
    </div>
  );
}
