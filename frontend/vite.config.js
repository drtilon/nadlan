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
      '.shefaug.com'
    ],
    watch: {
      usePolling: true,
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://backend:5001',
        changeOrigin: true,
        secure: false
      }
    }
  },

  // PRODUCTION BUILD OPTIMIZATIONS
  build: {
    // Use faster minifier
    minify: 'esbuild',

    // Disable sourcemaps in production (huge speedup)
    sourcemap: false,

    // Modern target
    target: 'esnext',

    // Optimize chunk splitting for MUI v5
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],

          // Router
          'router': ['react-router-dom'],

          // MUI v5 core
          'mui-core': [
            '@mui/material',
            '@emotion/react',
            '@emotion/styled'
          ],

          // MUI icons (tree-shaken properly in v5)
          'mui-icons': ['@mui/icons-material'],

          // MUI date pickers
          'mui-pickers': ['@mui/x-date-pickers'],

          // Charts
          'charts': ['recharts'],

          // Utilities
          'utils': ['axios', 'dotenv'],
        }
      }
    },

    // Performance settings
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,

    // Disable bundle analysis for faster builds
    reportCompressedSize: false,
  },

  // Remove console logs in production
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  // OPTIMIZED FOR MUI v5 - much better than v6
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled'
    ],
    // MUI v5 handles icons much better - no need to exclude
    force: true
  },

  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  }
})
