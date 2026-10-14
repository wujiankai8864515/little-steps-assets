import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('./web',import.meta.url)),
  base:process.env.PAGES_BASE||'/little-steps-assets/',
  server:{host:'127.0.0.1'},
  build:{outDir:'../dist',emptyOutDir:true,chunkSizeWarningLimit:1500},
});
