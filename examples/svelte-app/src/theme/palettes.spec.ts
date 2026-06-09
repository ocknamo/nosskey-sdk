import { describe, expect, it } from 'vitest';
import {
  type ResolvedTheme,
  THEME_PALETTES,
  normalizeThemeMode,
  resolveTheme,
} from './palettes.js';

describe('normalizeThemeMode', () => {
  it('returns the 4 color themes and auto unchanged', () => {
    for (const mode of [
      'purple-dark',
      'purple-light',
      'neutral-dark',
      'neutral-light',
      'auto',
    ] as const) {
      expect(normalizeThemeMode(mode)).toBe(mode);
    }
  });

  it('migrates legacy values to purple variants', () => {
    expect(normalizeThemeMode('dark')).toBe('purple-dark');
    expect(normalizeThemeMode('light')).toBe('purple-light');
  });

  it('returns null for unknown or missing values', () => {
    expect(normalizeThemeMode(null)).toBeNull();
    expect(normalizeThemeMode('')).toBeNull();
    expect(normalizeThemeMode('blue')).toBeNull();
    expect(normalizeThemeMode('PURPLE-DARK')).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('resolves auto to a purple variant based on OS preference', () => {
    expect(resolveTheme('auto', true)).toBe('purple-dark');
    expect(resolveTheme('auto', false)).toBe('purple-light');
  });

  it('passes explicit themes through regardless of OS preference', () => {
    for (const theme of ['purple-dark', 'purple-light', 'neutral-dark', 'neutral-light'] as const) {
      expect(resolveTheme(theme, true)).toBe(theme);
      expect(resolveTheme(theme, false)).toBe(theme);
    }
  });
});

describe('THEME_PALETTES', () => {
  const themes: ResolvedTheme[] = ['purple-dark', 'purple-light', 'neutral-dark', 'neutral-light'];

  it('defines all 4 resolved themes', () => {
    expect(Object.keys(THEME_PALETTES).sort()).toEqual([...themes].sort());
  });

  it('every theme exposes the identical set of CSS variable keys', () => {
    const reference = Object.keys(THEME_PALETTES['purple-dark']).sort();
    expect(reference.length).toBeGreaterThan(0);
    for (const theme of themes) {
      expect(Object.keys(THEME_PALETTES[theme]).sort()).toEqual(reference);
    }
  });

  it('every CSS variable key starts with "--"', () => {
    for (const theme of themes) {
      for (const key of Object.keys(THEME_PALETTES[theme])) {
        expect(key.startsWith('--')).toBe(true);
      }
    }
  });

  it('neutral themes replace the purple accent with a grey one', () => {
    expect(THEME_PALETTES['neutral-dark']['--color-primary']).not.toBe(
      THEME_PALETTES['purple-dark']['--color-primary']
    );
    expect(THEME_PALETTES['neutral-light']['--color-primary']).not.toBe(
      THEME_PALETTES['purple-light']['--color-primary']
    );
  });

  it('neutral themes use thicker borders than purple themes', () => {
    expect(THEME_PALETTES['purple-dark']['--border-width']).toBe('1px');
    expect(THEME_PALETTES['purple-light']['--border-width']).toBe('1px');
    expect(THEME_PALETTES['neutral-dark']['--border-width']).toBe('3px');
    expect(THEME_PALETTES['neutral-light']['--border-width']).toBe('3px');
  });

  it('neutral themes drop shadows while purple themes keep them', () => {
    expect(THEME_PALETTES['neutral-dark']['--color-shadow']).toBe('transparent');
    expect(THEME_PALETTES['neutral-light']['--color-shadow']).toBe('transparent');
    expect(THEME_PALETTES['purple-dark']['--color-shadow']).not.toBe('transparent');
    expect(THEME_PALETTES['purple-light']['--color-shadow']).not.toBe('transparent');
  });

  it('only neutral themes use the rounded font', () => {
    for (const theme of ['neutral-dark', 'neutral-light'] as const) {
      expect(THEME_PALETTES[theme]['--font-family']).toContain('M PLUS Rounded 1c');
    }
    for (const theme of ['purple-dark', 'purple-light'] as const) {
      expect(THEME_PALETTES[theme]['--font-family']).not.toContain('M PLUS Rounded 1c');
    }
  });
});
