/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial inspirada en el logo "SIN ESPINAS":
        // Olas turquesa/marina, Pez verde lima/esmeralda y Ají rojo carretillero
        ocean: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0ea5e9', // Azul ola
          600: '#0284c7', // Azul marino primario
          700: '#0369a1',
          800: '#142b47', // Azul profundo texto logo
          900: '#0a192f',
        },
        wave: {
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#142b47',
        },
        limefish: {
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
        },
        aji: {
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        }
      }
    },
  },
  plugins: [],
}

