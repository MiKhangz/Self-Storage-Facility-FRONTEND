import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.VITE_API_PROXY_TARGET ?? 'https://localhost:7001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The browser only ever talks to localhost:5173, so no dev-certificate warning and no CORS preflight.
    // secure:false lets this local proxy accept the backend's self-signed .NET dev certificate.
    proxy: { '/api': { target: backend, changeOrigin: true, secure: false } },
  },
})
