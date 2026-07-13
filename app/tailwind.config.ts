import type { Config } from "tailwindcss";

/**
 * SafeXBets "night-match scoreboard" palette.
 * Deep pitch-green base + chalk white + one electric floodlight accent.
 * Yes / No read as two opposing teams on a stadium scoreboard.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: "#04110A", // page base — stadium at night
          800: "#06180E",
          700: "#0A2114", // card
          600: "#0E2B1B", // raised panel
        },
        turf: {
          DEFAULT: "#0E2B1B",
          light: "#123420",
          line: "#1C4A2E",
        },
        chalk: {
          DEFAULT: "#EEFBF1", // primary text
          dim: "#B9D4C2",
        },
        mist: "#78A188", // muted text
        flood: {
          DEFAULT: "#CBFF3E", // electric lime accent (floodlight)
          soft: "#B4E838",
          deep: "#8FBF1F",
        },
        yes: {
          DEFAULT: "#2FE39A", // home team — fresh mint
          deep: "#12A56E",
        },
        no: {
          DEFAULT: "#FF9A3D", // away team — warm amber
        },
        alert: "#FF5C6C",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.8)",
        flood: "0 0 0 1px rgba(203,255,62,0.35), 0 8px 32px -8px rgba(203,255,62,0.45)",
        led: "0 0 18px -2px currentColor",
      },
      backgroundImage: {
        "flood-glow":
          "radial-gradient(120% 80% at 50% -10%, rgba(203,255,62,0.14), transparent 60%)",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "live-pulse": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.82)" },
        },
        "bar-fill": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "flood-flicker": {
          "0%,100%": { opacity: "0.9" },
          "45%": { opacity: "0.7" },
          "55%": { opacity: "1" },
        },
        "pot-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "live-pulse": "live-pulse 1.4s ease-in-out infinite",
        "bar-fill": "bar-fill 0.8s cubic-bezier(0.22,1,0.36,1) both",
        "flood-flicker": "flood-flicker 6s ease-in-out infinite",
        "pot-pop": "pot-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
