import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  esbuild: {
    target: 'es2020',
    jsx: 'automatic',
  },
  build: {
    target: 'es2020',
  }
})
