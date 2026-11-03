/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

/**
 * Design tokens for the LearnSpace ERP UI.
 *
 * `brand` is bound to CSS variables published by src/theme.ts so the whole
 * interface follows each school's white-label colour. The legacy `blue`,
 * `indigo` and `violet` scales (used as "primary" throughout the existing
 * pages) are aliased to `brand`, and `gray` is aliased to `slate`, which gives
 * every page one consistent neutral + accent system without touching page code.
 */
const brand = {
    50: 'rgb(var(--brand-50) / <alpha-value>)',
    100: 'rgb(var(--brand-100) / <alpha-value>)',
    200: 'rgb(var(--brand-200) / <alpha-value>)',
    300: 'rgb(var(--brand-300) / <alpha-value>)',
    400: 'rgb(var(--brand-400) / <alpha-value>)',
    500: 'rgb(var(--brand-500) / <alpha-value>)',
    600: 'rgb(var(--brand-600) / <alpha-value>)',
    700: 'rgb(var(--brand-700) / <alpha-value>)',
    800: 'rgb(var(--brand-800) / <alpha-value>)',
    900: 'rgb(var(--brand-900) / <alpha-value>)',
    950: 'rgb(var(--brand-900) / <alpha-value>)',
    DEFAULT: 'rgb(var(--brand-600) / <alpha-value>)',
    contrast: 'rgb(var(--brand-contrast) / <alpha-value>)',
};

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand,
                blue: brand,
                indigo: brand,
                violet: brand,
                purple: brand,
                sky: brand,
                cyan: brand,
                gray: colors.slate,
                surface: {
                    DEFAULT: '#ffffff',
                    muted: '#f6f7f9',
                    subtle: '#fbfbfc',
                },
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans Arabic', 'sans-serif'],
            },
            fontSize: {
                '2xs': ['0.6875rem', { lineHeight: '1rem' }],
            },
            boxShadow: {
                card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
                'card-hover': '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -1px rgb(15 23 42 / 0.04)',
                pop: '0 10px 30px -10px rgb(15 23 42 / 0.18), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
            },
            borderRadius: {
                DEFAULT: '0.5rem',
                md: '0.5rem',
            },
            keyframes: {
                'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
                'scale-in': { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'scale(1)' } },
            },
            animation: {
                'fade-in': 'fade-in 180ms ease-out both',
                'scale-in': 'scale-in 150ms ease-out both',
            },
        },
    },
    plugins: [],
}
