/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        /* =========
           Base UI
        ========= */
        background: '#f8fafc',
        foreground: '#0f172a',

        card: '#ffffff',
        panel: '#f8fafc',
        sidebar: '#ffffff',
        topbar: 'rgba(255,255,255,0.85)',

        text: '#0f172a',
        muted: '#64748b',

        border: '#e2e8f0',
        borderStrong: '#cbd5e1',
        input: '#e2e8f0',
        ring: '#3b82f6',

        /* =========
           Brand / Actions
        ========= */
        primary: '#2563eb',
        primaryHover: '#1d4ed8',

        /* =========
           Semantic states
        ========= */
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',

        successSoft: '#f0fdf4',
        warningSoft: '#fffbeb',
        dangerSoft: '#fef2f2',
        infoSoft: '#eff6ff',

        /* =========
           Dark mode fixed palette
        ========= */
        darkBg: '#020617',
        darkSurface: '#0f172a',
        darkCard: '#111827',
        darkSidebar: '#0b1220',
        darkTopbar: 'rgba(15,23,42,0.78)',
        darkText: '#f8fafc',
        darkMuted: '#94a3b8',
        darkBorder: '#1e293b',
        darkBorderStrong: '#334155',
        darkInput: '#0f172a',

        /* =========
           Optional accent glow
           usar poco, no en todo
        ========= */
        accentBlue: '#38bdf8',
        accentCyan: '#22d3ee',
        accentViolet: '#8b5cf6',
      },

      boxShadow: {
        soft: '0 2px 10px rgba(15, 23, 42, 0.05)',
        card: '0 8px 24px rgba(15, 23, 42, 0.06)',
        pop: '0 18px 50px rgba(15, 23, 42, 0.10)',
        darkSoft: '0 2px 10px rgba(0, 0, 0, 0.20)',
        darkCard: '0 10px 30px rgba(0, 0, 0, 0.28)',
        darkPop: '0 22px 60px rgba(0, 0, 0, 0.38)',
      },

      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.5rem',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },

  plugins: [],
};