import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function DappVisit() {
  const q = useQuery();
  const url = q.get("url") || "";
  const navigate = useNavigate();

  useEffect(() => {
    if (!url) navigate("/dapps");
  }, [url, navigate]);

  const handleOpenSameTab = () => {
    // Navigate top-level to the external site (full page view)
    window.location.assign(url);
  };

  const handleOpenNewTab = () => {
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 bg-transparent text-gray-700 flex items-center justify-center rounded-none border border-gray-200">
          <ExternalLink className="w-5 h-5" />
        </div>
        <div>
          <div className="font-medium">{(() => { try { return new URL(url).hostname } catch { return url } })()}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{url}</div>
        </div>
      </div>

      <Card className="rounded-none border border-gray-300/20">
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm">You are about to open the external DApp in full page. This will navigate away from the wallet app. If the site requires a wallet connection, approve the connection when prompted.</p>
            <div className="flex items-center gap-2">
              <Button onClick={handleOpenSameTab} className="rounded-none bg-green-600 text-white">Open in this tab</Button>
              <Button onClick={handleOpenNewTab} variant="outline" className="rounded-none">Open in new tab</Button>
              <Button variant="ghost" onClick={() => navigate('/dapps')} className="rounded-none">Cancel</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
        Note: some sites require the DApp to initiate a connection request. If you control the DApp, implement a postMessage or window.opener postMessage to request a connection from the wallet.
      </div>
    </div>
  );
}
