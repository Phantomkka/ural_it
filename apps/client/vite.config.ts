import { defineConfig } from 'vite';
export default defineConfig({ server: { proxy: { '/game': { target: 'http://127.0.0.1:2567', ws: true, rewrite: path => path.replace(/^\/game/, '') } } } });
