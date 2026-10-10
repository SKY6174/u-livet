import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        xs: ["calc(1rem + var(--type-adjust))", { lineHeight: "1.6" }],
        sm: ["calc(1rem + var(--type-adjust))", { lineHeight: "1.6" }],
        base: ["calc(1.125rem + var(--type-adjust))", { lineHeight: "1.6" }],
        lg: ["calc(1.125rem + var(--type-adjust))", { lineHeight: "1.5" }],
        xl: ["calc(1.25rem + var(--type-adjust))", { lineHeight: "1.4" }],
        "2xl": ["calc(1.5rem + var(--type-adjust))", { lineHeight: "1.3" }],
        "3xl": ["calc(1.875rem + var(--type-adjust))", { lineHeight: "1.25" }],
        "4xl": ["calc(2.25rem + var(--type-adjust))", { lineHeight: "1.2" }],
        "5xl": ["calc(3rem + var(--type-adjust))", { lineHeight: "1.1" }],
        "6xl": ["calc(3.75rem + var(--type-adjust))", { lineHeight: "1.1" }],
      },
      colors: {
        // 울산과학대학교 앵커사업단 브랜드 컬러 팔레트
        uc: {
          navy: {
            DEFAULT: "#0f2b5c", // 대표 네이비
            dark: "#0a1d3f",
            light: "#1e3a8a",
          },
          blue: {
            DEFAULT: "#0066cc",
            light: "#e0f2fe",
          },
          orange: {
            DEFAULT: "#f39200", // 앵커사업단 포인트 오렌지
            hover: "#d97706",
          },
          gray: {
            bg: "#f8fafc",
            card: "#ffffff",
            border: "#e2e8f0",
            text: "#1e293b",
            muted: "#64748b",
          }
        }
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
