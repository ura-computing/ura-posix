import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
// Important: CRXJS prefers the manifest to be a JS/JSON object
import manifest from './public/manifest.json' 

export default defineConfig({
  plugins: [
    react(),
    // CRXJS handles the manifest and all assets automatically
    crx({ manifest }),
  ],
  build: {
    outDir: 'build', // Matches your requirement
    rollupOptions: {
      input: {
        // The manifest becomes the entry point, 
        // but you can still keep index.html if needed
        main: './index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})