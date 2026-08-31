/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        '1': '0.2rem',
        '2': '0.4rem',
        '3': '0.6rem',
        '4': '0.8rem',
        '5': '1rem',
        '6': '1.2rem',
        '8': '1.6rem',
        '10': '2rem',
        '12': '2.4rem',
        '16': '3.2rem',
      },
      fontSize: {
        'xs': ['0.7rem', { lineHeight: '1rem' }],
        'sm': ['0.8rem', { lineHeight: '1.15rem' }],
        'base': ['0.9rem', { lineHeight: '1.35rem' }],
        'lg': ['1rem', { lineHeight: '1.5rem' }],
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem', { lineHeight: '2rem' }],
      }
    },
  },
  plugins: [],
};