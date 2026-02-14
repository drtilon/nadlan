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

    // Disable sourcemaps in production (huge speedup + security)
    sourcemap: false,

    // Modern target - smaller bundles
    target: 'es2022',

    // Optimize chunk splitting for lazy-loaded routes
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - loaded on every page
          'react-vendor': ['react', 'react-dom'],

          // Router - loaded on every page
          'router': ['react-router-dom'],

          // MUI core - loaded on every page
          'mui-core': [
            '@mui/material',
            '@emotion/react',
            '@emotion/styled'
          ],

          // MUI icons - tree-shaken, separate chunk
          'mui-icons': ['@mui/icons-material'],

          // MUI date pickers - only loaded when needed
          'mui-pickers': ['@mui/x-date-pickers'],

          // Charts - only loaded on analytics pages
          'charts': ['recharts'],

          // Utilities
          'utils': ['axios'],
        }
      }
    },

    // Performance settings
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,

    // CSS code splitting - each lazy route gets its own CSS
    cssCodeSplit: true,

    // Disable bundle analysis for faster builds
    reportCompressedSize: false,
  },

  // Remove console logs in production
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  // Pre-bundle heavy dependencies for faster dev server startup
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
      '@mui/icons-material',
      'axios',
      'recharts'
    ],
    // Note: recharts must be included (not excluded) because it uses
    // lodash CommonJS modules that need pre-bundling for ESM compatibility
  },

  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  }
})
