import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'shefaug.com',
      'www.shefaug.com',
      '207.154.221.54',
      '.shefaug.com' // This allows all subdomains
    ],
    watch: {
      usePolling: true,
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://flask_backend:5001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
