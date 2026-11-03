/**
 * White-label theme engine.
 *
 * Generates a full 50–900 tonal palette from a single brand hex colour and
 * publishes it as CSS custom properties (`--brand-50` … `--brand-900`) on
 * <html>. Tailwind's `brand`, `blue`, `indigo` and `violet` colour scales are
 * bound to these variables (see tailwind.config.js), so every button, link,
 * focus ring and badge across the ERP follows the active school's colour.
 *
 * Presentation only — no business logic lives here.
 */

export const DEFAULT_BRAND_COLOR = '#2563eb';

type RGB = { r: number; g: number; b: number };

const clamp = (v: number, min = 0, max = 255) => Math.min(max, Math.max(min, v));

const hexToRgb = (hex: string): RGB | null => {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: Math.round(clamp(a.r + (b.r - a.r) * t)),
  g: Math.round(clamp(a.g + (b.g - a.g) * t)),
  b: Math.round(clamp(a.b + (b.b - a.b) * t)),
});

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 15, g: 23, b: 42 }; // slate-900 for a softer dark end

/** Tint / shade steps relative to the base colour (which sits at 600). */
const STEPS: Record<string, number> = {
  '50': 0.94,
  '100': 0.88,
  '200': 0.74,
  '300': 0.56,
  '400': 0.32,
  '500': 0.14,
  '600': 0,
  '700': -0.18,
  '800': -0.34,
  '900': -0.5,
};

export const buildBrandScale = (hex: string): Record<string, string> => {
  const base = hexToRgb(hex) || (hexToRgb(DEFAULT_BRAND_COLOR) as RGB);
  const scale: Record<string, string> = {};
  for (const [key, t] of Object.entries(STEPS)) {
    const c = t >= 0 ? mix(base, WHITE, t) : mix(base, BLACK, -t);
    scale[key] = `${c.r} ${c.g} ${c.b}`;
  }
  return scale;
};

/** Relative luminance – used to pick readable foreground on brand surfaces. */
export const isLightColor = (hex: string): boolean => {
  const c = hexToRgb(hex);
  if (!c) return false;
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.72;
};

let lastApplied: string | null = null;

/** Apply a brand colour to the document. Safe to call repeatedly. */
export const applyBrandTheme = (hex?: string | null) => {
  const color = hex && hexToRgb(hex) ? hex : DEFAULT_BRAND_COLOR;
  if (typeof document === 'undefined' || lastApplied === color) return;
  lastApplied = color;
  const root = document.documentElement;
  const scale = buildBrandScale(color);
  for (const [k, v] of Object.entries(scale)) {
    root.style.setProperty(`--brand-${k}`, v);
  }
  root.style.setProperty('--brand-hex', color);
  root.style.setProperty('--brand-contrast', isLightColor(color) ? '15 23 42' : '255 255 255');
};
