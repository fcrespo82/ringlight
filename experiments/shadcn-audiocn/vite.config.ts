import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icons/*.png', 'icons/*.svg'],
    manifest: { id: './', name: 'Ringlight · shadcn + audiocn', short_name: 'Ringlight Lab', lang: 'pt-BR', start_url: './', scope: './', display: 'standalone', theme_color: '#17191d', background_color: '#000000', icons: [{src:'icons/icon-192.png', sizes:'192x192',type:'image/png',purpose:'any maskable'}, {src:'icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}] },
    workbox: { cacheId: 'ringlight-lab', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] }
  })]
})
