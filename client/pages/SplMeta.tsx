import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface MetaForm {
  name: string;
  symbol: string;
  description: string;
  logoURI: string; // data URL or external URL
  website: string;
  twitter: string;
  telegram: string;
  dexpair: string;
  lastUpdated: string; // ISO string
}

const defaultForm: MetaForm = {
  name: "FixerCoin",
  symbol: "FXR",
  description: "",
  logoURI: "",
  website: "",
  twitter: "",
  telegram: "",
  dexpair: "",
  lastUpdated: new Date().toISOString(),
};

export default function SplMeta() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<MetaForm>(() => {
    try {
      const raw = localStorage.getItem("spl_meta_form");
      if (raw) return { ...defaultForm, ...JSON.parse(raw) } as MetaForm;
    } catch {}
    return { ...defaultForm };
  });
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    setLogoPreview(form.logoURI || "");
  }, [form.logoURI]);

  const datetimeLocal = useMemo(() => {
    try {
      const d = new Date(form.lastUpdated || Date.now());
      const pad = (n: number) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    } catch {
      return "";
    }
  }, [form.lastUpdated]);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setForm((f) => ({ ...f, logoURI: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (key: keyof MetaForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const saveLocal = () => {
    try {
      const payload = { ...form, lastUpdated: new Date(form.lastUpdated || Date.now()).toISOString() };
      localStorage.setItem("spl_meta_form", JSON.stringify(payload));
      toast({ title: "SAVED", description: "SPL-META FORM SAVED LOCALLY" });
    } catch (e) {
      toast({ title: "SAVE FAILED", description: String(e), variant: "destructive" });
    }
  };

  const copyJson = async () => {
    const payload = { ...form, lastUpdated: new Date(form.lastUpdated || Date.now()).toISOString() };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "COPIED", description: "JSON COPIED TO CLIPBOARD" });
    } catch (e) {
      toast({ title: "COPY FAILED", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-wider">SPL-META</h1>
          <Button variant="secondary" onClick={() => navigate("/")}>BACK TO WALLET</Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold tracking-wider">NAME</Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="FixerCoin"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">SYMBOL</Label>
            <Input
              value={form.symbol}
              onChange={(e) => handleChange("symbol", e.target.value)}
              placeholder="FXR"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">DESCRIPTION</Label>
            <Textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={4}
              placeholder="LONG DESCRIPTION"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">LOGOURI (IMAGE UPLOAD)</Label>
            <div className="flex items-center gap-3">
              <Input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
              <Input
                value={form.logoURI}
                onChange={(e) => handleChange("logoURI", e.target.value)}
                placeholder="https://…"
              />
            </div>
            {logoPreview ? (
              <div className="mt-2">
                <img src={logoPreview} alt="LOGO PREVIEW" className="h-16 w-16 rounded-md object-cover border border-white/10" />
              </div>
            ) : null}
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">WEBSITE</Label>
            <Input
              type="url"
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">TWITTER</Label>
            <Input
              type="url"
              value={form.twitter}
              onChange={(e) => handleChange("twitter", e.target.value)}
              placeholder="https://twitter.com/…"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">TELEGRAM</Label>
            <Input
              type="url"
              value={form.telegram}
              onChange={(e) => handleChange("telegram", e.target.value)}
              placeholder="https://t.me/…"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">DEXPAIR</Label>
            <Input
              value={form.dexpair}
              onChange={(e) => handleChange("dexpair", e.target.value)}
              placeholder="RAYDIUM PAIR ADDRESS"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider">LASTUPDATED</Label>
            <Input
              type="datetime-local"
              value={datetimeLocal}
              onChange={(e) => {
                const v = e.target.value;
                const iso = v ? new Date(v).toISOString() : new Date().toISOString();
                handleChange("lastUpdated", iso);
              }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveLocal} className="flex-1">SAVE</Button>
            <Button variant="secondary" onClick={copyJson} className="flex-1">COPY JSON</Button>
          </div>

          <div className="mt-4">
            <Label className="text-xs font-semibold tracking-wider">PREVIEW JSON</Label>
            <pre className="mt-2 text-xs bg-black/30 p-3 rounded-lg border border-white/10 overflow-auto">
{JSON.stringify({ ...form, lastUpdated: new Date(form.lastUpdated || Date.now()).toISOString() }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
