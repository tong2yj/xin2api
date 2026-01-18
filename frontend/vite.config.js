import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:10601",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://localhost:10601",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:10601",
        ws: true,
      },
    },
  },
  build: {
    outDir: "../backend/static",
    emptyOutDir: true,
    // 性能优化配置
    rollupOptions: {
      output: {
        // 手动分块策略
        manualChunks: {
          // React 核心库单独打包
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI 组件库单独打包
          'ui-vendor': ['lucide-react'],
          // HTTP 客户端单独打包
          'http-vendor': ['axios'],
        },
        // 优化资源命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 设置 chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
    // 使用 esbuild 压缩（更快）
    minify: 'esbuild',
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'lucide-react'],
  },
});
