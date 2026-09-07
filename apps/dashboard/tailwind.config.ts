import type { Config } from 'tailwindcss'

/**
 * Starling dashboard tokens.
 * CSS variables are the source of truth in src/index.css;
 * this config maps the same names into Tailwind utilities.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design tokens (status colour only via live/warn/fail/idle)
        ground: 'var(--ground)',
        panel: 'var(--panel)',
        line: 'var(--line)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        live: 'var(--live)',
        warn: 'var(--warn)',
        fail: 'var(--fail)',
        idle: 'var(--idle)',
        // shadcn semantic aliases → same token set
        border: 'var(--line)',
        input: 'var(--line)',
        ring: 'var(--live)',
        background: 'var(--ground)',
        foreground: 'var(--text)',
        primary: {
          DEFAULT: 'var(--text)',
          foreground: 'var(--ground)',
        },
        secondary: {
          DEFAULT: 'var(--panel)',
          foreground: 'var(--text)',
        },
        destructive: {
          DEFAULT: 'var(--fail)',
          foreground: 'var(--text)',
        },
        accent: {
          DEFAULT: 'var(--panel)',
          foreground: 'var(--text)',
        },
        card: {
          DEFAULT: 'var(--panel)',
          foreground: 'var(--text)',
        },
        popover: {
          DEFAULT: 'var(--panel)',
          foreground: 'var(--text)',
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.375rem',
        md: '0.25rem',
        sm: '0.125rem',
      },
    },
  },
  plugins: [],
}

export default config
