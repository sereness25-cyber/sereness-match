import { defineConfig } from 'vite'
export default defineConfig({
  root: 'app',
  base: './',
  resolve: { preserveSymlinks: true },
  build: { outDir: '../dist', emptyOutDir: true },
})
