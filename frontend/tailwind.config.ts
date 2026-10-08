import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // Original brand tokens (used in app routes — preserved)
        brand: {
          white: '#FFFFFF',
          mint: '#E8F5E9',
          'mint-subtle': '#F4FBF5',
          emerald: '#2E7D32',
          olive: '#81C784',
          charcoal: '#212121',
          'charcoal-muted': '#555555',
          forest: '#1B5E20',
          border: '#E0E0E0',
          highlight: '#A5D6A7',
        },
        // ElevateCV design system tokens
        ecv: {
          bg: '#F7F6F2',
          surface: '#FFFFFF',
          text: '#171717',
          'text-muted': '#626262',
          'text-subtle': '#909090',
          border: '#E4E2DC',
          'border-strong': '#C9C6BE',
          accent: '#16A36A',
          'accent-soft': '#E3F6ED',
          'accent-mid': '#B2EACF',
          'accent-dark': '#0E7A50',
          dark: '#171717',
          'dark-surface': '#1C1C1A',
          'dark-text': '#FFFFFF',
          'dark-muted': '#A0A09A',
        },
        primary: {
          DEFAULT: '#2E7D32',
          foreground: '#FFFFFF',
          hover: '#1B5E20',
        },
        secondary: {
          DEFAULT: '#E8F5E9',
          foreground: '#1B5E20',
        },
        muted: {
          DEFAULT: '#F5F7F5',
          foreground: '#666666',
        },
        accent: {
          DEFAULT: '#81C784',
          foreground: '#1B5E20',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#212121',
        },
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        subtle: '0 2px 10px rgba(0, 0, 0, 0.03)',
        card: '0 4px 20px -2px rgba(46, 125, 50, 0.08)',
        'card-hover': '0 12px 30px -4px rgba(46, 125, 50, 0.15)',
        glow: '0 0 25px rgba(129, 199, 132, 0.35)',
        // ElevateCV shadows
        'ecv-card': '0 1px 4px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.03)',
        'ecv-card-hover': '0 4px 20px rgba(0,0,0,0.08)',
        'ecv-subtle': '0 1px 3px rgba(0,0,0,0.04)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        countUp: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-delayed': 'float 4s ease-in-out 2s infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        shimmer: 'shimmer 2.5s infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
