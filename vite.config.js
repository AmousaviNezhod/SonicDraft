import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwind()],
  server: { port: 3000 },
  build: { outDir: 'dist' },
});
