import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3100,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // 127.0.0.1 (não 'localhost') pois localhost resolve p/ IPv6 (::1) e o
        // backend escuta só IPv4 (0.0.0.0) — 'localhost' causaria ECONNREFUSED.
        target: 'http://127.0.0.1:4100',
        changeOrigin: true,
      },
    },
  },
})
