import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import ckeditor5 from "@ckeditor/vite-plugin-ckeditor5";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ckeditor5({ theme: require.resolve("@ckeditor/ckeditor5-theme-lark") }),
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
  optimizeDeps: {
    include: [
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@codemirror/lang-markdown",
      "@mui/icons-material/AttachFileRounded",
      "@mui/icons-material/SaveRounded",
      "@mui/icons-material/CloseRounded",
      "@mui/icons-material/DescriptionRounded",
    ],
  },
  server: {
    port: 4444,
  },
})
