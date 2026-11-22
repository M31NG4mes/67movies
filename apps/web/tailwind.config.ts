import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 67movies Purple Dark Cinema Palette
        brand: {
          main: '#8065FF',       // Primary Purple Accent
          light: '#A18BFF',      // Secondary Lavender Hover
          glow: 'rgba(128, 101, 255, 0.45)',
        },
        cinema: {
          dark: '#09090D',       // Deep Obsidian Canvas
          surface: '#111119',    // Sidebar / Secondary Dark
          card: '#181821',       // Card Surface
          cardHover: '#20202C',
          border: '#292936',     // Subtle Border
          muted: '#92929F',      // Muted Gray
          text: '#FFFFFF',       // Crisp White Text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Montserrat', 'sans-serif'],
      },
      backgroundImage: {
        'hero-vignette-x':
          'linear-gradient(90deg, rgba(9, 9, 13, 0.92) 0%, rgba(9, 9, 13, 0.62) 38%, rgba(9, 9, 13, 0.14) 68%, rgba(9, 9, 13, 0) 100%)',
        'hero-vignette-y':
          'linear-gradient(180deg, rgba(9, 9, 13, 0.42) 0%, rgba(9, 9, 13, 0.12) 45%, rgba(9, 9, 13, 0.78) 84%, #09090D 100%)',
      },
      boxShadow: {
        'brand-glow': '0 10px 28px -6px rgba(128, 101, 255, 0.52)',
        'card-glow': '0 14px 32px -8px rgba(128, 101, 255, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
