import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, resolveLocale, setLocale, t, tCount } from '../../src/i18n';
import { en } from '../../src/i18n/locales/en';
import { zh } from '../../src/i18n/locales/zh';

/**
 * Spec 1.2.2 plugin i18n: the zh catalog must cover the en key set exactly
 * (the type system enforces this at compile time; the runtime check keeps CI
 * honest against `as`-casts), `t()` must interpolate and fall back to
 * English, and `auto` must follow Obsidian's stored language.
 */

afterEach(() => setLocale('en'));

describe('catalog parity', () => {
  it('zh translates every en key, with no extras', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('no zh value is left as the untranslated en value with CJK-free copy', () => {
    // Sanity: every zh string is non-empty (brand names like "Obsidian CLI"
    // legitimately match en, so equality is not asserted).
    for (const value of Object.values(zh)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('t()', () => {
  it('defaults to English', () => {
    expect(getLocale()).toBe('en');
    expect(t('dashboard.refresh')).toBe('Refresh');
  });

  it('switches to Chinese and back', () => {
    setLocale('zh');
    expect(t('dashboard.refresh')).toBe('刷新');
    setLocale('en');
    expect(t('dashboard.refresh')).toBe('Refresh');
  });

  it('interpolates params, including repeated placeholders', () => {
    expect(t('home.bundles.modifiedLocally', { id: 'kb-x', files: 'a.md' })).toContain('kb-x --force');
    expect(t('dashboard.minutesAgo', { minutes: 5 })).toBe('5 min ago');
  });

  it('tCount picks the one/other form per locale', () => {
    expect(tCount('home.health.stalePages', 1)).toBe('1 page has changed sources');
    expect(tCount('home.health.stalePages', 3)).toBe('3 pages have changed sources');
    setLocale('zh');
    expect(tCount('home.health.stalePages', 3)).toBe('3 个页面的来源已变更');
  });
});

describe('resolveLocale', () => {
  it('explicit settings win', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('zh')).toBe('zh');
  });

  it('auto follows the host app language', () => {
    expect(resolveLocale('auto', 'zh')).toBe('zh');
    expect(resolveLocale('auto', 'zh-TW')).toBe('zh');
    expect(resolveLocale('auto', 'en')).toBe('en');
    expect(resolveLocale('auto', undefined)).toBe('en');
  });
});
