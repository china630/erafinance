import type { Config } from "tailwindcss";

export default {
  content: ["./entrypoints/**/*.{tsx,html}", "./src/**/*.{tsx,ts}"],
  theme: {
    extend: {
      colors: {
        erafinance: {
          surface: "#EBEDF0",
          ink: "#1a1a1a",
          accent: "#2563eb",
        },
      },
    },
  },
} satisfies Config;
