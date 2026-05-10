/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#071525',
        aqua: '#14b8a6',
        gold: '#f6d88b',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(7, 21, 37, 0.12)',
      },
    },
  },
  plugins: [],
}
