import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set BASE_PATH in CI, '/' everywhere else.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5173 },
})
