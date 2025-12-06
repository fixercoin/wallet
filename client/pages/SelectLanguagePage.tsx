import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check } from "lucide-react";
import {
  useLanguage,
  getLanguages,
  type Language,
} from "@/contexts/LanguageContext";

export default function SelectLanguagePage() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const languages = getLanguages();

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
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
              {t("language-setting", "Language Settings")}
            </span>
          </div>

          <div className="space-y-3">
            {languages.map((lang) => (
              <Card
                key={lang.code}
                className={`cursor-pointer border-2 transition-all bg-transparent border-gray-300/30`}
                onClick={() => handleLanguageSelect(lang.code as Language)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {lang.name}
                    </span>
                    {language === lang.code && (
                      <Check className="h-5 w-5 text-green-500 font-bold" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
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
