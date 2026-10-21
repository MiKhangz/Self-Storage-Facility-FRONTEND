import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'https://localhost:7001', changeOrigin: true, secure: false } },
  },
});
