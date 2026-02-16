import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// Unique build ID embedded in both the JS bundle and dist/version.json
const BUILD_ID = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'FamilyLists',
        short_name: 'FamilyLists',
        description: 'Collaborative list management for families',
        theme_color: '#FAF8F5',
        background_color: '#FAF8F5',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    }),
    // Write version.json to dist after build completes
    {
      name: 'version-json',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist')
        mkdirSync(distDir, { recursive: true })
        writeFileSync(
          resolve(distDir, 'version.json'),
          JSON.stringify({ buildId: BUILD_ID })
        )
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
