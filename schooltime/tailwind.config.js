/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4ff',
          100: '#dce8ff',
          200: '#b3ccff',
          500: '#3b6ef5',
          600: '#2355e0',
          700: '#1a3fb5',
          800: '#162f86',
          900: '#111f5c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
