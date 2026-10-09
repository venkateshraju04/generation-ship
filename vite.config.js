import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022', // top-level await in main.js
    chunkSizeWarningLimit: 900, // three.js alone is ~700 kB minified
  },
});
