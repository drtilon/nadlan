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
        target: 'http://flask_backend:5001',
        changeOrigin: true,
        secure: false
      }
    }
  },

  // BUILD OPTIMIZATIONS FOR MUI PROJECT
  build: {
    // Use faster minifier
    minify: 'esbuild',

    // Disable sourcemaps in production (huge speedup)
    sourcemap: false,

    // Modern target
    target: 'esnext',

    // Optimize chunk splitting for MUI
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],

          // Router
          'router': ['react-router-dom'],

          // MUI core (split these heavy libraries)
          'mui-core': [
            '@mui/material',
            '@emotion/react',
            '@emotion/styled'
          ],

          // MUI icons (usually very large)
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

  // Pre-bundle dependencies (important for MUI)
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
      'axios'
    ],
    // Exclude heavy dependencies from pre-bundling
    exclude: [
      '@mui/icons-material',
      '@mui/x-date-pickers'
    ]
  },

  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  }
})
