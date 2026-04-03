/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 与 index.css CSS 变量对应，方便在 Tailwind 类中直接使用
        "theme-bg-primary":    "var(--theme-bg-primary)",
        "theme-bg-secondary":  "var(--theme-bg-secondary)",
        "theme-bg-sidebar":    "var(--theme-bg-sidebar)",
        "theme-bg-chat":       "var(--theme-bg-chat)",
        "theme-bg-chat-input": "var(--theme-bg-chat-input)",
        "theme-text-primary":  "var(--theme-text-primary)",
        "theme-text-secondary":"var(--theme-text-secondary)",
        "theme-button-primary":"var(--theme-button-primary)",
        "theme-button-cta":    "var(--theme-button-cta)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
