import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 使用 @/ 作为 src/ 的别名，与 AnythingLLM 保持一致
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    // 开发模式：将 /api 请求代理到后端，避免跨域
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
