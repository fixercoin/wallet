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
  const toast = useToast().toast;
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      navigate("/dapps");
    }
  }, [url, navigate]);

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

  return (
    <div className="w-full max-w-6xl mx-auto p-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-transparent text-gray-700 flex items-center justify-center rounded-none border border-gray-200">
            <ExternalLink className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium">{(() => { try { return new URL(url).hostname } catch { return url } })()}</div>
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
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
        If the site blocks being embedded, use "Open in new tab". For secure connection handshakes we can add a postMessage bridge — let me know if you want that.
      </div>
    </div>
  );
}
