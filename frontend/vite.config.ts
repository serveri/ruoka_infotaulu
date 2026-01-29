import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// vite.config.ts
export default defineConfig({
   plugins: [
      vue(),
      VitePWA({
         registerType: "autoUpdate",
         includeAssets: [
            // keep non-icon assets
            "og.png",
            "favicon.svg",
            "favicon.ico",
            "apple-touch-icon.png"
         ],
         manifest: {
            name: "UEF Kuopio Lunch",
            short_name: "UEF Lunch",
            description: "UEF Kuopio Campus Restaurant Menus",
            start_url: "/",
            scope: "/",
            display: "standalone",
            background_color: "#0b0f19",
            theme_color: "#10b981",
            icons: [
               // Use existing transparent PNGs and provide maskable variants
               {
                  src: "/web-app-manifest-192x192.png",
                  sizes: "192x192",
                  type: "image/png"
               },
               {
                  src: "/web-app-manifest-512x512.png",
                  sizes: "512x512",
                  type: "image/png"
               },
               {
                  src: "/web-app-manifest-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "maskable any"
               },
               {
                  src: "/web-app-manifest-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable any"
               }
            ]
         },
         workbox: {
            globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"]
         }
      })
   ],
   server: {
      proxy: {
         "/tietoteknia": {
            target:
               "https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi",
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/tietoteknia/, "")
         },
         "/antell": {
            target:
               "https://www.compass-group.fi/menuapi/feed/json?costNumber=3488&language=fi",
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/antell/, "")
         },
         "/snelmannia": {
            target:
               "https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi",
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/snelmannia/, "")
         },
         "/canthia": {
            target:
               "https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi",
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/canthia/, "")
         }
      }
   },
   preview: {
      allowedHosts: ["lunchmenu.s.serveriry.fi", "lunch.serveriry.fi"]
   }
});
