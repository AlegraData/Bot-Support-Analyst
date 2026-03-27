import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00C4A0',
          dark: '#00A888',
          light: '#E0F7F4',
        },
        dark: {
          DEFAULT: '#1e2a3a',
          2: '#2d3748',
        },
        brand: {
          gray50: '#f7fafc',
          gray100: '#f0f4f8',
          gray200: '#e2e8f0',
          gray400: '#a0aec0',
          gray600: '#718096',
          gray900: '#1a202c',
        },
      },
      boxShadow: {
        brand: '0 4px 20px rgba(0,0,0,0.08)',
        'brand-hover': '0 8px 32px rgba(0,0,0,0.14)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
        'bot-enter': 'botEnter 2s ease-in-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 60%, 100%': { transform: 'scale(1)', opacity: '0.5' },
          '30%': { transform: 'scale(1.4)', opacity: '1' },
        },
        botEnter: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '40%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
