/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          1: '#161b27',
          2: '#1e2535',
          3: '#252d40',
        },
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          glow: '#6366f133',
        },
        teal: {
          accent: '#2dd4bf',
          glow: '#2dd4bf22',
        },
        amber: {
          accent: '#f59e0b',
        },
        rose: {
          accent: '#f43f5e',
        },
        emerald: {
          accent: '#10b981',
        },
      },
      fontFamily: {
        display: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
