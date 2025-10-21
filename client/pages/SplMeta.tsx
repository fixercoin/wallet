import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface MetaForm {
  name: string;
  symbol: string;
  contractAddress: string;
  description: string;
  logoURI: string; // data URL or external URL
  website: string;
  twitter: string;
  telegram: string;
  dexpair: string;
  lastUpdated: string; // ISO string
}

const defaultForm: MetaForm = {
  name: "FIXERCOIN",
  symbol: "FIXERCOIN",
  contractAddress: "",
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

  const handleChange = (key: keyof MetaForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const saveLocal = () => {
    try {
      const payload = {
        ...form,
        lastUpdated: new Date(form.lastUpdated || Date.now()).toISOString(),
      };
      localStorage.setItem("spl_meta_form", JSON.stringify(payload));
      toast({ title: "SAVED", description: "SPL-META FORM SAVED LOCALLY" });
    } catch (e) {
      toast({
        title: "SAVE FAILED",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const submitToApis = async () => {
    const payload = {
      ...form,
      lastUpdated: new Date(form.lastUpdated || Date.now()).toISOString(),
    };
    try {
      const res = await fetch("/api/spl-meta/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(err || `Submit failed (${res.status})`);
      }
      toast({
        title: "SUBMITTED",
        description: "REQUEST QUEUED FOR DIRECTORY UPDATE",
      });
    } catch (e) {
      toast({
        title: "SUBMIT FAILED",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const copyJson = async () => {
    const payload = {
      ...form,
      lastUpdated: new Date(form.lastUpdated || Date.now()).toISOString(),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "COPIED", description: "JSON COPIED TO CLIPBOARD" });
    } catch (e) {
      toast({
        title: "COPY FAILED",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements (same as dashboard) */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="max-w-md mx-auto px-4 py-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-wider text-white">
            SPL-META
          </h1>
          <button
            aria-label="Go back"
            className="p-2 rounded-lg hover:bg-white/10 text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              NAME
            </Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="FIXERCOIN"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              SYMBOL
            </Label>
            <Input
              value={form.symbol}
              onChange={(e) => handleChange("symbol", e.target.value)}
              placeholder="FIXERCOIN"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              CONTRACT ADDRESS
            </Label>
            <Input
              value={form.contractAddress}
              onChange={(e) => handleChange("contractAddress", e.target.value)}
              placeholder="Mint address"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              DESCRIPTION
            </Label>
            <Textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={4}
              placeholder="LONG DESCRIPTION"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              LOGO URL
            </Label>
            <Input
              type="url"
              value={form.logoURI}
              onChange={(e) => handleChange("logoURI", e.target.value)}
              placeholder="https://…"
            />
            {logoPreview ? (
              <div className="mt-2">
                <img
                  src={logoPreview}
                  alt="LOGO PREVIEW"
                  className="h-16 w-16 rounded-md object-cover border border-white/10"
                />
              </div>
            ) : null}
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              WEBSITE
            </Label>
            <Input
              type="url"
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              TWITTER
            </Label>
            <Input
              type="url"
              value={form.twitter}
              onChange={(e) => handleChange("twitter", e.target.value)}
              placeholder="https://twitter.com/…"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              TELEGRAM
            </Label>
            <Input
              type="url"
              value={form.telegram}
              onChange={(e) => handleChange("telegram", e.target.value)}
              placeholder="https://t.me/…"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold tracking-wider text-white">
              DEXPAIR
            </Label>
            <Input
              value={form.dexpair}
              onChange={(e) => handleChange("dexpair", e.target.value)}
              placeholder="PAIR ADDRESS"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={saveLocal}
              className="flex-1 wallet-button-primary"
            >
              SAVE
            </Button>
            <Button
              onClick={submitToApis}
              className="flex-1 wallet-button-primary"
            >
              SUBMIT
            </Button>
            <Button onClick={copyJson} className="flex-1 wallet-button-primary">
              COPY JSON
            </Button>
          </div>

          <div className="mt-4">
            <Label className="text-xs font-semibold tracking-wider text-white">
              PREVIEW JSON
            </Label>
            <pre className="mt-2 text-xs bg-black/30 p-3 rounded-lg border border-white/10 overflow-auto text-white">
              {JSON.stringify(
                {
                  ...form,
                  lastUpdated: new Date(
                    form.lastUpdated || Date.now(),
                  ).toISOString(),
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
