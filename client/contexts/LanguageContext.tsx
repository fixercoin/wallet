import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type Language =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "zh"
  | "ja"
  | "ar"
  | "ur"
  | "hi"
  | "pt";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  languageName: string;
  t: (key: string, defaultValue?: string) => string;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español (Spanish)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "ur", name: "اردو (Urdu)" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "pt", name: "Português (Portuguese)" },
] as const;

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const LANGUAGE_KEY = "preferred_language";

const translations: Record<Language, Record<string, string>> = {
  en: {
    "select-language": "Select Language",
    "change-currency": "Change Currency",
    "language-setting": "Language Settings",
    "currency-setting": "Currency Settings",
    select: "Select",
    back: "Back",
    selected: "Selected",
    language: "Language",
    currency: "Currency",
    "major-currencies": "Major Currencies",
  },
  es: {
    "select-language": "Seleccionar idioma",
    "change-currency": "Cambiar moneda",
    "language-setting": "Configuración de idioma",
    "currency-setting": "Configuración de moneda",
    select: "Seleccionar",
    back: "Atrás",
    selected: "Seleccionado",
    language: "Idioma",
    currency: "Moneda",
    "major-currencies": "Monedas principales",
  },
  fr: {
    "select-language": "Sélectionner la langue",
    "change-currency": "Changer de devise",
    "language-setting": "Paramètres de langue",
    "currency-setting": "Paramètres de devise",
    select: "Sélectionner",
    back: "Retour",
    selected: "Sélectionné",
    language: "Langue",
    currency: "Devise",
    "major-currencies": "Devises principales",
  },
  de: {
    "select-language": "Sprache auswählen",
    "change-currency": "Währung ändern",
    "language-setting": "Spracheinstellungen",
    "currency-setting": "Währungseinstellungen",
    select: "Auswählen",
    back: "Zurück",
    selected: "Ausgewählt",
    language: "Sprache",
    currency: "Währung",
    "major-currencies": "Hauptwährungen",
  },
  zh: {
    "select-language": "选择语言",
    "change-currency": "更改货币",
    "language-setting": "语言设置",
    "currency-setting": "货币设置",
    select: "选择",
    back: "返回",
    selected: "已选择",
    language: "语言",
    currency: "货币",
    "major-currencies": "主要货币",
  },
  ja: {
    "select-language": "言語を選択",
    "change-currency": "通貨を変更",
    "language-setting": "言語設定",
    "currency-setting": "通貨設定",
    select: "選択",
    back: "戻る",
    selected: "選択済み",
    language: "言語",
    currency: "通貨",
    "major-currencies": "主要通貨",
  },
  ar: {
    "select-language": "اختر اللغة",
    "change-currency": "تغيير العملة",
    "language-setting": "إعدادات اللغة",
    "currency-setting": "إعدادات العملة",
    select: "اختر",
    back: "عودة",
    selected: "محدد",
    language: "اللغة",
    currency: "العملة",
    "major-currencies": "العملات الرئيسية",
  },
  ur: {
    "select-language": "زبان منتخب کریں",
    "change-currency": "کرنسی تبدیل کریں",
    "language-setting": "زبان کی ترتیبات",
    "currency-setting": "کرنسی کی ترتیبات",
    select: "منتخب کریں",
    back: "واپس",
    selected: "منتخب",
    language: "زبان",
    currency: "کرنسی",
    "major-currencies": "اہم کرنسیاں",
  },
  hi: {
    "select-language": "भाषा चुनें",
    "change-currency": "मुद्रा बदलें",
    "language-setting": "��ाषा सेटिंग्स",
    "currency-setting": "मुद्रा सेटिंग्स",
    select: "चुनें",
    back: "वापस",
    selected: "चयनित",
    language: "भाषा",
    currency: "मुद्रा",
    "major-currencies": "मुख्य मुद्राएं",
  },
  pt: {
    "select-language": "Selecionar idioma",
    "change-currency": "Alterar moeda",
    "language-setting": "Configurações de idioma",
    "currency-setting": "Configurações de moeda",
    select: "Selecionar",
    back: "Voltar",
    selected: "Selecionado",
    language: "Idioma",
    currency: "Moeda",
    "major-currencies": "Moedas principais",
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = (localStorage.getItem(LANGUAGE_KEY) as Language) || "en";
      return saved;
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
      document.documentElement.lang = language;
      if (language === "ar" || language === "ur") {
        document.documentElement.dir = "rtl";
      } else {
        document.documentElement.dir = "ltr";
      }
    } catch {}
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
      document.documentElement.lang = lang;
      if (lang === "ar" || lang === "ur") {
        document.documentElement.dir = "rtl";
      } else {
        document.documentElement.dir = "ltr";
      }
    } catch {}
  };

  const languageName =
    LANGUAGES.find((l) => l.code === language)?.name || "English";

  const t = (key: string, defaultValue?: string): string => {
    return translations[language]?.[key] ?? defaultValue ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, languageName, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};

export const getLanguages = () => LANGUAGES;
