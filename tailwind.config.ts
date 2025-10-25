import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
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
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Wallet-specific colors
        wallet: {
          purple: {
            50: "#faf5ff",
            100: "#f3e8ff",
            500: "#8b5cf6",
            600: "#7c3aed",
          },
          blue: {
            50: "#eff6ff",
            100: "#dbeafe",
            500: "#3b82f6",
            600: "#2563eb",
          },
          success: {
            50: "#f0fdf4",
            100: "#dcfce7",
            500: "#22c55e",
            600: "#16a34a",
          },
          error: {
            50: "#fef2f2",
            100: "#fee2e2",
            500: "#ef4444",
            600: "#dc2626",
          }
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "burning-flame": {
          "0%, 100%": {
            transform: "scale(1) rotate(0deg)",
            color: "#fb923c",
            filter: "drop-shadow(0 0 2px rgba(251, 146, 60, 0.6))",
          },
          "25%": {
            transform: "scale(1.1) rotate(2deg)",
            color: "#ff6b35",
            filter: "drop-shadow(0 0 4px rgba(255, 107, 53, 0.8))",
          },
          "50%": {
            transform: "scale(0.95) rotate(-1deg)",
            color: "#ff4500",
            filter: "drop-shadow(0 0 6px rgba(255, 69, 0, 1))",
          },
          "75%": {
            transform: "scale(1.05) rotate(1deg)",
            color: "#ff6b35",
            filter: "drop-shadow(0 0 4px rgba(255, 107, 53, 0.8))",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "burning-flame": "burning-flame 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
