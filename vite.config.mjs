import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:4380','/files':'http://127.0.0.1:4380'}},build:{chunkSizeWarningLimit:1500}});
