import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// vite.config.js
export default defineConfig({
   plugins: [vue()],
   server: {
      proxy: {
         '/tietoteknia': {
            target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/tietoteknia/, '')
         },
         '/antell': {
            target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=3488&language=fi',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/antell/, '')
         },
         '/snelmannia': {
            target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/snelmannia/, '')
         },
         '/canthia': {
            target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/canthia/, '')
         }
      }
   }
});
