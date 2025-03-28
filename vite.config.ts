import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { ViteDevServer } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Add custom plugin to handle WASM MIME types
    {
      name: "configure-wasm-mime-type",
      configureServer(server: ViteDevServer) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 3000,
    open: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // Prevent Vite from trying to bundle WebAssembly modules
  optimizeDeps: {
    exclude: ["@mysten/move-bytecode-template"],
  },
  // Support modern features including WebAssembly
  build: {
    target: "esnext",
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
