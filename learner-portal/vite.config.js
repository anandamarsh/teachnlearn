import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo.png", "icons/pwa-192.png", "icons/pwa-512.png"],
      manifest: {
        name: "Move-N-Learn",
        short_name: "Move-N-Learn",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1e5dbb",
        icons: [
          {
            src: "/icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5000,
  },
})
