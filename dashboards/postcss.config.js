// Tailwind 3 runs as a PostCSS plugin. Vite reads this file once it lands; the
// Tailwind CLI reads it today.
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
