/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#080810',
        surface:  '#0f0f18',
        surface2: '#17172a',
        surface3: '#1e1e35',
        border:   '#252538',
        border2:  '#32324a',
        muted:    '#5a5a7a',
        muted2:   '#8888aa',
        accent:   '#7c6af7',
        accent2:  '#4fc3f7',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['"Instrument Serif"', 'serif'],
      },
    },
  },
  plugins: [],
}
