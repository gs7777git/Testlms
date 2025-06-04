import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Optional: specify dev server port
  },
  // If deploying to a subdirectory on Netlify (e.g. your-site.netlify.app/crm/), 
  // you might need to set the base path:
  // base: '/crm/', 
  // Otherwise, for root deployment, leave it as default or '/'.
  base: '/', 
})