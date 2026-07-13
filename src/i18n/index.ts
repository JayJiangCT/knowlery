import { en, type TranslationKey } from './locales/en';
import { zh } from './locales/zh';

export type { TranslationKey };

/** Locales with a shipped catalog. This release adds Simplified Chinese. */
export type KnowleryLocale = 'en' | 'zh';

/** The settings value: an explicit locale, or follow Obsidian's language. */
export type LanguageSetting = 'auto' | KnowleryLocale;

const CATALOGS: Record<KnowleryLocale, Record<TranslationKey, string>> = { en, zh };

/** Module-level current locale: set once at plugin load and on the settings
 * dropdown change; `t()` reads it at call time, so React re-renders pick up
 * a switch without any provider plumbing. Defaults to English (tests and any
 * pre-`setLocale` call see the original copy). */
let currentLocale: KnowleryLocale = 'en';

export function setLocale(locale: KnowleryLocale): void {
  currentLocale = locale;
}

export function getLocale(): KnowleryLocale {
  return currentLocale;
}

/**
 * Maps the language setting to a concrete locale. `auto` follows the host
 * app's language, which the plugin shell passes in from Obsidian's
 * `getLanguage()` (`zh` / `zh-TW` prefixes = Chinese, anything else =
 * English). This module stays platform-pure — it is imported by core modules
 * that also ship in the CLI — so it never touches the obsidian API itself.
 */
export function resolveLocale(setting: LanguageSetting, appLanguage?: string): KnowleryLocale {
  if (setting === 'en' || setting === 'zh') return setting;
  return appLanguage?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/** Translates a key in the current locale, interpolating `{name}` params. */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = CATALOGS[currentLocale][key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** Count-aware variant for the few pluralized keys (`.one` / `.other`). */
export function tCount(base: 'skills.count' | 'home.health.stalePages' | 'home.health.uncooked' | 'home.health.sourcesChanged', count: number): string {
  const key = `${base}.${count === 1 ? 'one' : 'other'}` as TranslationKey;
  return t(key, { count });
}
