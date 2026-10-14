import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['../../tests/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
});
