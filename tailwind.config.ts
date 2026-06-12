import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        glow: "0 0 45px rgba(45, 212, 191, 0.16)",
        "soft-xl": "0 32px 100px rgba(0, 0, 0, 0.42)",
        neon: "0 0 36px rgba(45, 212, 191, 0.16), 0 0 90px rgba(251, 146, 60, 0.10)"
      },
      backgroundImage: {
        "grid-radial":
          "radial-gradient(circle at 10% 8%, rgba(20,184,166,.18), transparent 28rem), radial-gradient(circle at 92% 14%, rgba(244,63,94,.12), transparent 30rem), radial-gradient(circle at 66% 96%, rgba(245,158,11,.10), transparent 32rem), linear-gradient(180deg, #050706 0%, #071211 50%, #07080c 100%)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
