import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Optional: specify dev server port
    open: true, // Optional: automatically open browser on dev server start
  },
  // If deploying to a subdirectory on Netlify (e.g. your-site.netlify.app/crm/), 
  // you might need to set the base path here.
  // For root deployment (e.g., crm.your-domain.com or your-site.netlify.app),
  // the default '/' is correct.
  base: '/', 
})