import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { useWallet } from "@/contexts/WalletContext";
import { Search as SearchIcon, ExternalLink } from "lucide-react";

interface DappInfo {
  name: string;
  url: string;
  description?: string;
  icon?: string;
}

const DEFAULT_DAPPS: DappInfo[] = [
  {
    name: "Uniswap Clone",
    url: "https://app.uniswap.example",
    description: "Swap tokens and provide liquidity",
  },
  {
    name: "NFT Gallery",
    url: "https://nft.gallery.example",
    description: "Browse and buy NFTs",
  },
  {
    name: "DeFi Dashboard",
    url: "https://defi.example",
    description: "Track yields and positions",
  },
];

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
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState<any[]>(() => readConnected());
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  useEffect(() => {
    setConnected(readConnected());
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEFAULT_DAPPS;
    return DEFAULT_DAPPS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.url.toLowerCase().includes(q),
    );
  }, [query]);

  const isConnectedTo = (url: string) =>
    connected.find((c) => c.url === url && c.walletPublicKey === wallet?.publicKey);

  const handleConnect = async (d: DappInfo) => {
    if (!wallet) {
      toast({ title: "No Wallet", description: "Please select or create a wallet first.", variant: "destructive" });
      return;
    }

    const provider = ensureFixoriumProvider();
    if (!provider) {
      toast({ title: "Provider Unavailable", description: "Wallet provider not available.", variant: "destructive" });
      return;
    }

    try {
      setLoadingUrl(d.url);
      const res = await provider.connect();
      const publicKey = res?.publicKey?.toBase58 ? res.publicKey.toBase58() : String(res?.publicKey || wallet.publicKey);

      const current = readConnected();
      const exists = current.find((c) => c.url === d.url && c.walletPublicKey === publicKey);
      if (!exists) {
        const next = [
          ...current,
          { name: d.name, url: d.url, connectedAt: Date.now(), walletPublicKey: publicKey },
        ];
        writeConnected(next);
        setConnected(next);
      }

      toast({ title: "DApp Connected", description: `${d.name} connected to ${publicKey}` });
    } catch (err: any) {
      console.error("Connect failed", err);
      toast({ title: "Connect Failed", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setLoadingUrl(null);
    }
  };

  const handleDisconnect = (url: string) => {
    const next = readConnected().filter((c) => c.url !== url || c.walletPublicKey !== wallet?.publicKey);
    writeConnected(next);
    setConnected(next);
    toast({ title: "DApp Disconnected", description: `Disconnected ${url}` });
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 py-6">
      <div className="mb-4">
        <label className="text-sm text-gray-500 uppercase">SEARCH DAPPS</label>
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or url"
            className="rounded-none"
          />
          <Button className="rounded-none">
            <SearchIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((d) => (
          <Card key={d.url} className="rounded-none border border-gray-300/30">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-200 text-gray-700 flex items-center justify-center rounded-none">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{d.url}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isConnectedTo(d.url) ? (
                  <Button variant="outline" className="rounded-none" onClick={() => handleDisconnect(d.url)}>
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
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-2 text-sm font-medium">Connected DApps</div>
        <div className="space-y-2">
          {connected.length === 0 && <div className="text-xs text-[hsl(var(--muted-foreground))]">No connected dapps</div>}
          {connected.map((c) => (
            <Card key={`${c.url}-${c.walletPublicKey}`} className="rounded-none border border-gray-300/20">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{c.url}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{new Date(c.connectedAt).toLocaleString()}</div>
                </div>
                <div>
                  <Button variant="outline" onClick={() => handleDisconnect(c.url)} className="rounded-none">Disconnect</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
