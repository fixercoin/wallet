import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Check } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveApiUrl } from "@/lib/api-client";

type MajorCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "AUD"
  | "CAD"
  | "CHF"
  | "CNY"
  | "INR"
  | "PKR";

const MAJOR_CURRENCIES: Array<{
  code: MajorCurrency;
  name: string;
  symbol: string;
}> = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
];

const FALLBACK_RATES: Record<MajorCurrency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.12,
  PKR: 278.5,
};

export default function SelectCurrencyPage() {
  const navigate = useNavigate();
  const { currency, setCurrency } = useCurrency();
  const { t } = useLanguage();
  const [exchangeRates, setExchangeRates] =
    useState<Record<string, number>>(FALLBACK_RATES);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const symbols = MAJOR_CURRENCIES.map((c) => c.code).join(",");
        const res = await fetch(
          resolveApiUrl(`/api/forex/rate?base=USD&symbols=${symbols}`),
        );
        if (res.ok) {
          const data = await res.json();
          if (data.rates && Object.keys(data.rates).length > 0) {
            setExchangeRates(data.rates);
          } else {
            setExchangeRates(FALLBACK_RATES);
          }
        } else {
          setExchangeRates(FALLBACK_RATES);
        }
      } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        setExchangeRates(FALLBACK_RATES);
      }
    };

    fetchRates();
  }, []);

  const handleCurrencySelect = (curr: MajorCurrency) => {
    if (curr === "USD" || curr === "PKR") {
      setCurrency(curr as any);
    }
  };

  const getExchangeRate = (code: MajorCurrency): string => {
    if (code === "USD") return "1.00";
    const rate = exchangeRates[code] || FALLBACK_RATES[code];
    if (!rate) return "N/A";
    return rate.toFixed(2);
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-gray-800 text-gray-900 relative overflow-hidden capitalize">
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-4 py-6 space-y-3 relative z-20">
        <div className="mt-6 mb-1 rounded-[2px] p-6 border-0 bg-transparent relative overflow-hidden text-gray-900">
          <div className="flex items-center gap-2 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-8 w-8 p-0 rounded-md bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
              aria-label={t("back", "Back")}
            >
              <ArrowLeft
                className="h-4 w-4 text-black"
                fill="none"
                strokeWidth={2}
              />
            </Button>
            <span className="text-sm font-semibold text-gray-900">
              {t("currency-setting", "Currency Settings")}
            </span>
          </div>

          <p className="text-xs text-gray-600 mb-4">
            {t("major-currencies", "Major Currencies")} (with USD exchange
            rates)
          </p>

          <div className="space-y-3">
            {MAJOR_CURRENCIES.map((curr) => {
              const isSelectable = curr.code === "USD" || curr.code === "PKR";
              const isSelected =
                (currency === "USD" && curr.code === "USD") ||
                (currency === "PKR" && curr.code === "PKR");

              return (
                <Card
                  key={curr.code}
                  className={`cursor-pointer border-2 transition-all bg-transparent border-gray-300/30 ${!isSelectable && "opacity-60"}`}
                  onClick={() =>
                    isSelectable && handleCurrencySelect(curr.code)
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {curr.symbol} {curr.code}
                        </div>
                        <div className="text-xs text-gray-600">{curr.name}</div>
                        <div className="text-[10px] text-gray-500 mt-1">
                          1 USD = {getExchangeRate(curr.code)} {curr.code}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-green-500 font-bold" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 text-xs text-gray-600">
            <p>
              Currently, USD and PKR currencies are available for full support.
              Other currencies display exchange rates for reference.
            </p>
          </div>

          <div className="mt-6">
            <Button
              className="w-full h-11 font-semibold border-0 rounded-lg bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white shadow-lg"
              onClick={() => navigate("/")}
            >
              {t("select", "Select")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
