import { defineConfig } from 'vite'
export default defineConfig({
  root: 'admin',
  base: './',
  resolve: { preserveSymlinks: true },
  server: { host: '127.0.0.1', fs: { strict: true } },
  build: { outDir: '../dist-admin', emptyOutDir: true },
})
