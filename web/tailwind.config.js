/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0F172A",
        ink: "#1E293B",
        azure: "#2563EB",
        sky: "#3B82F6",
        route: "#2563EB",
        canvas: "#F1F5F9",
        paper: "#FFFFFF",
        slate: {
          DEFAULT: "#64748B",
          light: "#E2E8F0",
          soft: "#F1F5F9",
        },
        muted: "#94A3B8",
        good: "#059669",
        warn: "#D97706",
        bad: "#DC2626",
        accent: {
          soft: "#EFF6FF",
          DEFAULT: "#2563EB",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.06)",
        float: "0 12px 40px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.06)",
        nav: "4px 0 24px rgba(15,23,42,0.08)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.45s ease-out",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.65", transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};
