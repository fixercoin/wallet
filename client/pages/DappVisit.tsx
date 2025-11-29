import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function DappVisit() {
  const q = useQuery();
  const url = q.get("url") || "";
  const navigate = useNavigate();
  const { toast } = useToast();

  const popupRef = useRef<Window | null>(null);
  const parentPingRef = useRef<number | null>(null);
  const popupPollRef = useRef<number | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (!url) navigate("/dapps");
    return () => {
      if (parentPingRef.current) window.clearInterval(parentPingRef.current);
      if (popupPollRef.current) window.clearInterval(popupPollRef.current);
    };
  }, [url, navigate]);

  const handleOpenSameTab = () => {
    // Navigate top-level to the external site (full page view)
    window.location.assign(url);
  };

  const handleOpenInNewTab = () => {
    window.open(url, "_blank", "noopener");
  };

  const handleOpenPopup = () => {
    try {
      const w = window.open(
        url,
        "_blank",
        "toolbar=no,location=no,status=no,menubar=no,width=1100,height=800",
      );
      if (!w) {
        toast({
          title: "Popup blocked",
          description: "Allow popups to enable DApp connection.",
          variant: "destructive",
        });
        return;
      }
      popupRef.current = w;
      setPopupOpen(true);
      toast({
        title: "DApp opened",
        description: "Popup opened — waiting for handshake.",
      });

      const origin = (() => {
        try {
          return new URL(url).origin;
        } catch {
          return "*";
        }
      })();

      // send PARENT_READY repeatedly until popup closed
      parentPingRef.current = window.setInterval(() => {
        try {
          popupRef.current?.postMessage?.({ type: "PARENT_READY" }, origin);
        } catch {}
      }, 500);

      // poll popup close
      popupPollRef.current = window.setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          popupRef.current = null;
          setPopupOpen(false);
          if (parentPingRef.current) {
            window.clearInterval(parentPingRef.current);
            parentPingRef.current = null;
          }
          if (popupPollRef.current) {
            window.clearInterval(popupPollRef.current);
            popupPollRef.current = null;
          }
        }
      }, 500);
    } catch (e: any) {
      toast({
        title: "Open failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleClosePopup = () => {
    try {
      popupRef.current?.close();
    } catch {}
    popupRef.current = null;
    setPopupOpen(false);
    if (parentPingRef.current) {
      window.clearInterval(parentPingRef.current);
      parentPingRef.current = null;
    }
    if (popupPollRef.current) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  };

  // Listen for REQUEST_CONNECT from popup (or CONNECT_RESPONSE) and respond
  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      try {
        if (!ev.data || typeof ev.data !== "object") return;
        const { type, requestId } = ev.data as any;
        if (type === "REQUEST_CONNECT") {
          const allow = window.confirm(
            `DApp requests wallet connection. Allow?`,
          );
          if (!allow) {
            ev.source?.postMessage?.(
              {
                type: "CONNECT_RESPONSE",
                success: false,
                error: "User rejected",
                requestId,
              },
              ev.origin,
            );
            return;
          }
          try {
            const provider = ensureFixoriumProvider();
            if (!provider) throw new Error("Provider unavailable");
            const res = await provider.connect();
            const pub = res?.publicKey?.toBase58
              ? res.publicKey.toBase58()
              : String(res?.publicKey);
            ev.source?.postMessage?.(
              {
                type: "CONNECT_RESPONSE",
                success: true,
                publicKey: pub,
                requestId,
              },
              ev.origin,
            );
            toast({ title: "DApp Connected", description: `${pub}` });
            // close popup after connect
            try {
              ev.source?.close?.();
            } catch {}
            handleClosePopup();
          } catch (err: any) {
            ev.source?.postMessage?.(
              {
                type: "CONNECT_RESPONSE",
                success: false,
                error: err?.message || String(err),
                requestId,
              },
              ev.origin,
            );
            toast({
              title: "Connect Failed",
              description: err?.message || String(err),
              variant: "destructive",
            });
          }
        }
      } catch (e) {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [toast]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 bg-transparent text-gray-700 flex items-center justify-center rounded-none border border-gray-200">
          <ExternalLink className="w-5 h-5" />
        </div>
        <div>
          <div className="font-medium">
            {(() => {
              try {
                return new URL(url).hostname;
              } catch {
                return url;
              }
            })()}
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {url}
          </div>
        </div>
      </div>

      <Card className="rounded-none border border-gray-300/20">
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm">
              You are about to open the external DApp. For a seamless connection
              the app can be opened in a popup which will request a connection
              automatically (if the DApp implements the handshake).
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleOpenSameTab}
                className="rounded-none bg-green-600 text-white"
              >
                Open in this tab
              </Button>
              <Button
                onClick={handleOpenInNewTab}
                variant="outline"
                className="rounded-none"
              >
                Open in new tab
              </Button>
              {!popupOpen ? (
                <Button onClick={handleOpenPopup} className="rounded-none">
                  Open popup & auto-connect
                </Button>
              ) : (
                <Button
                  onClick={handleClosePopup}
                  variant="outline"
                  className="rounded-none"
                >
                  Close popup
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => navigate("/dapps")}
                className="rounded-none"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
        Note: some sites require the DApp to initiate a connection request. For
        best UX add this snippet to the DApp so it can auto-request when opened
        in a popup by the wallet:
        <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto rounded-none">{`// In the DApp page
function listenForParent() {
  window.addEventListener('message', (ev) => {
    if (ev.data?.type === 'PARENT_READY') {
      // parent is ready, request connection
      const requestId = Math.random().toString(36).slice(2, 9);
      const target = window.opener || window.parent;
      target.postMessage({ type: 'REQUEST_CONNECT', requestId }, ev.origin || '*');

      window.addEventListener('message', (r) => {
        if (r.data?.type === 'CONNECT_RESPONSE' && r.data.requestId === requestId) {
          if (r.data.success) {
            console.log('Connected', r.data.publicKey);
          } else {
            console.error('Connect failed', r.data.error);
          }
        }
      }, { once: true });
    }
  });
}

listenForParent();`}</pre>
      </div>
    </div>
  );
}
