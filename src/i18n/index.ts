import en from "./en";
import ar from "./ar";
import ja from "./ja";

export type Language = "en" | "ar" | "ja";
export type Direction = "ltr" | "rtl";

export const translations: Record<Language, Record<string, string>> = { en, ar, ja };

export const SUPPORTED_LANGUAGES: { code: Language; label: string; nativeLabel: string; direction: Direction }[] = [
  { code: "en", label: "English", nativeLabel: "English", direction: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", direction: "rtl" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", direction: "ltr" },
];

export function getDirection(lang: Language): Direction {
  return lang === "ar" ? "rtl" : "ltr";
}

export function translate(lang: Language, key: string): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}
