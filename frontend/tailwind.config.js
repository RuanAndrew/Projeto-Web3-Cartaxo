/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.4" }],   // 14px (mínimo para textos auxiliares)
        sm: ["0.9375rem", { lineHeight: "1.5" }],  // 15px
        base: ["1rem", { lineHeight: "1.55" }],    // 16px (padrão da aplicação)
        lg: ["1.125rem", { lineHeight: "1.5" }],   // 18px
        xl: ["1.25rem", { lineHeight: "1.35" }],   // 20px
        "2xl": ["1.5rem", { lineHeight: "1.25" }], // 24px
        "3xl": ["2rem", { lineHeight: "1.2" }],    // 32px
      },
    },
  },
  plugins: [],
};
