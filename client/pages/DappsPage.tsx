import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { useWallet } from "@/contexts/WalletContext";
import { Search as SearchIcon, ExternalLink, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DappInfo {
  name: string;
  url: string;
  description?: string;
  icon?: string;
}

const CONNECTED_DAPPS_KEY = "connected_dapps";

const readConnected = () => {
  try {
    const raw = localStorage.getItem(CONNECTED_DAPPS_KEY);
    if (!raw) return [] as any[];
    return JSON.parse(raw) as any[];
  } catch {
    return [] as any[];
  }
};

const writeConnected = (arr: any[]) => {
  try {
    localStorage.setItem(CONNECTED_DAPPS_KEY, JSON.stringify(arr));
  } catch {}
};

export default function DappsPage() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState<any[]>(() => readConnected());
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  useEffect(() => {
    setConnected(readConnected());
  }, []);

  const normalizeUrl = (u: string) => {
    try {
      let v = u.trim();
      if (!v) return "";
      if (!v.startsWith("http://") && !v.startsWith("https://")) {
        v = `https://${v}`;
      }
      const url = new URL(v);
      return url.href;
    } catch {
      return u.trim();
    }
  };

  const isLikelyUrl = (s: string) => {
    if (!s) return false;
    const t = s.trim();
    if (t.startsWith("http://") || t.startsWith("https://")) return true;
    return /\S+\.\S+/.test(t);
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as DappInfo[];
    // No local index — return empty list; rely on custom URL connect or external integration
    return [] as DappInfo[];
  }, [query]);

  const customDapp = useMemo(() => {
    if (!query) return null;
    if (!isLikelyUrl(query)) return null;
    const url = normalizeUrl(query);
    // don't treat as custom if blank
    if (!url) return null;
    try {
      return {
        name: new URL(url).hostname,
        url,
        description: "Custom DApp",
      } as DappInfo;
    } catch {
      return { name: query, url, description: "Custom DApp" } as DappInfo;
    }
  }, [query]);

  const isConnectedTo = (url: string) =>
    connected.find(
      (c) => c.url === url && c.walletPublicKey === wallet?.publicKey,
    );

  const handleConnect = async (d: DappInfo) => {
    if (!wallet) {
      toast({
        title: "No Wallet",
        description: "Please select or create a wallet first.",
        variant: "destructive",
      });
      return;
    }

    const provider = ensureFixoriumProvider();
    if (!provider) {
      toast({
        title: "Provider Unavailable",
        description: "Wallet provider not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Require that user opened the site first in this session
      if (lastOpenedUrl !== d.url) {
        toast({
          title: "Open the site first",
          description:
            "Please open the DApp site and then connect from there or return and click Connect.",
          variant: "destructive",
        });
        return;
      }

      setLoadingUrl(d.url);
      const res = await provider.connect();
      const publicKey = res?.publicKey?.toBase58
        ? res.publicKey.toBase58()
        : String(res?.publicKey || wallet.publicKey);

      const current = readConnected();
      const exists = current.find(
        (c) => c.url === d.url && c.walletPublicKey === publicKey,
      );
      if (!exists) {
        const next = [
          ...current,
          {
            name: d.name,
            url: d.url,
            connectedAt: Date.now(),
            walletPublicKey: publicKey,
          },
        ];
        writeConnected(next);
        setConnected(next);
      }

      toast({
        title: "DApp Connected",
        description: `${d.name} connected to ${publicKey}`,
      });
    } catch (err: any) {
      console.error("Connect failed", err);
      toast({
        title: "Connect Failed",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setLoadingUrl(null);
    }
  };

  const handleDisconnect = (url: string) => {
    const next = readConnected().filter(
      (c) => c.url !== url || c.walletPublicKey !== wallet?.publicKey,
    );
    writeConnected(next);
    setConnected(next);
    toast({ title: "DApp Disconnected", description: `Disconnected ${url}` });
  };

  return (
    <div className="w-full md:max-w-lg mx-auto p-4 capitalize">
      <div className="pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      <Card className="mb-4 rounded-none border border-gray-300/30">
        <CardContent className="p-3">
          <label className="text-sm text-gray-500 uppercase block">
            SEARCH DAPPS
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or url"
              className="rounded-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setQuery((q) => q.trim());
                }
              }}
            />
            <Button
              className="rounded-none"
              onClick={() => setQuery((q) => q.trim())}
            >
              <SearchIcon className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {/* If query looks like a URL and it's not in the default list show a quick connect card */}
        {customDapp && (
          <Card
            key={customDapp.url}
            className="rounded-none border border-gray-300/30"
          >
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-transparent text-gray-700 flex items-center justify-center rounded-none">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">{customDapp.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {customDapp.url}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate(
                      `/dapps/visit?url=${encodeURIComponent(customDapp.url)}`,
                    );
                  }}
                  className="text-xs bg-white/5 px-3 py-2 rounded-none border border-gray-300/20 hover:bg-white/10"
                >
                  Open in app
                </button>
                {isConnectedTo(customDapp.url) ? (
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => handleDisconnect(customDapp.url)}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleConnect(customDapp)}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-none"
                    disabled={!!loadingUrl}
                  >
                    {loadingUrl === customDapp.url
                      ? "Connecting..."
                      : "Connect"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {items.length === 0 && !customDapp ? (
          <div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
            No dapps available. Enter a DApp URL above to open or connect (e.g.
            https://example.com).
          </div>
        ) : (
          items.map((d) => (
            <Card
              key={d.url}
              className="rounded-none border border-gray-300/30"
            >
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-transparent text-gray-700 flex items-center justify-center rounded-none">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {d.url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigate(`/dapps/visit?url=${encodeURIComponent(d.url)}`);
                    }}
                    className="text-xs bg-white/5 px-3 py-2 rounded-none border border-gray-300/20 hover:bg-white/10"
                  >
                    Open in app
                  </button>
                  {isConnectedTo(d.url) ? (
                    <Button
                      variant="outline"
                      className="rounded-none"
                      onClick={() => handleDisconnect(d.url)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleConnect(d)}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-none"
                      disabled={!!loadingUrl}
                    >
                      {loadingUrl === d.url ? "Connecting..." : "Connect"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="mt-6 rounded-none border border-gray-300/30">
        <CardContent className="p-3">
          <div className="mb-2 text-sm font-medium uppercase">
            CONNECTED DAPPS
          </div>
          <div className="space-y-2">
            {connected.length === 0 && (
              <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase">
                NO CONNECTED DAPPS
              </div>
            )}

            {connected.map((c) => (
              <Card
                key={`${c.url}-${c.walletPublicKey}`}
                className="rounded-none border border-gray-300/20"
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium capitalize">{c.name}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {c.url}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(c.connectedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => handleDisconnect(c.url)}
                      className="rounded-none"
                    >
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
