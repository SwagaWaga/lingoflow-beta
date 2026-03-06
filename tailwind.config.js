/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#0d9488',     // teal-600
          tealAlt: '#115e59',  // teal-800
          blue: '#1e3a8a',     // blue-900
          navy: '#172554',     // blue-950
        }
      }
    },
  },
  plugins: [],
}
