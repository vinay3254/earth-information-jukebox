import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  server: { allowedHosts: true },
  preview: { allowedHosts: true }
});
