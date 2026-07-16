import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        blocked: 'blocked.html',
        setup: 'setup.html',
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
