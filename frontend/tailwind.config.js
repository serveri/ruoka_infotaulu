export default {
   darkMode: "class",
   content: [
      "./index.html",
      "./pages/**/*.{ts,tsx,vue}",
      "./components/**/*.{ts,tsx,vue}",
      "./app/**/*.{ts,tsx,vue}",
      "./src/**/*.{ts,tsx,vue}"
   ],
   prefix: "",
   theme: {
      container: {
         center: true,
         padding: "2rem",
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
            destructive: {
               DEFAULT: "hsl(var(--destructive))",
               foreground: "hsl(var(--destructive-foreground))"
            },
            muted: {
               DEFAULT: "hsl(var(--muted))",
               foreground: "hsl(var(--muted-foreground))"
            },
            accent: {
               DEFAULT: "hsl(var(--accent))",
               foreground: "hsl(var(--accent-foreground))"
            },
            popover: {
               DEFAULT: "hsl(var(--popover))",
               foreground: "hsl(var(--popover-foreground))"
            },
            card: {
               DEFAULT: "hsl(var(--card))",
               foreground: "hsl(var(--card-foreground))"
            },
            // Custom food-themed colors
            "warm-orange": "hsl(var(--warm-orange))",
            "warm-orange-light": "hsl(var(--warm-orange-light))",
            "forest-green": "hsl(var(--forest-green))",
            "forest-green-light": "hsl(var(--forest-green-light))",
            cream: "hsl(var(--cream))",
            sage: "hsl(var(--sage))",
            sidebar: {
               DEFAULT: "hsl(var(--sidebar-background))",
               foreground: "hsl(var(--sidebar-foreground))",
               primary: "hsl(var(--sidebar-primary))",
               "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
               accent: "hsl(var(--sidebar-accent))",
               "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
               border: "hsl(var(--sidebar-border))",
               ring: "hsl(var(--sidebar-ring))"
            }
         },
         backgroundImage: {
            "gradient-warm": "var(--gradient-warm)",
            "gradient-fresh": "var(--gradient-fresh)",
            "gradient-subtle": "var(--gradient-subtle)"
         },
         boxShadow: {
            soft: "var(--shadow-soft)",
            menu: "var(--shadow-menu)",
            glow: "var(--shadow-glow)"
         },
         transitionTimingFunction: {
            smooth: "var(--transition-smooth)"
         },
         borderRadius: {
            lg: "var(--radius)",
            md: "calc(var(--radius) - 2px)",
            sm: "calc(var(--radius) - 4px)"
         },
         keyframes: {
            "accordion-down": {
               from: {
                  height: "0"
               },
               to: {
                  height: "var(--radix-accordion-content-height)"
               }
            },
            "accordion-up": {
               from: {
                  height: "var(--radix-accordion-content-height)"
               },
               to: {
                  height: "0"
               }
            }
         },
         animation: {
            "accordion-down": "accordion-down 0.2s ease-out",
            "accordion-up": "accordion-up 0.2s ease-out"
         }
      }
   }
};
