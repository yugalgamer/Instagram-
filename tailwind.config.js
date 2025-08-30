/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vedx: {
          primary: '#1e1e1e',
          secondary: '#252526',
          tertiary: '#2d2d30',
          hover: '#37373d',
          active: '#414042',
          border: '#3e3e42',
          text: {
            primary: '#cccccc',
            secondary: '#969696',
            muted: '#6a6a6a'
          },
          accent: {
            blue: '#007acc',
            green: '#4ec9b0',
            orange: '#ce9178',
            purple: '#c586c0',
            red: '#f44747',
            yellow: '#dcdcaa'
          }
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 2s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      }
    },
  },
  plugins: [],
}