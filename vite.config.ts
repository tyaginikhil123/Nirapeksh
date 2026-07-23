import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nirapekshApiPlugin } from './server/api-plugin.ts'

export default defineConfig({
  plugins: [react(), nirapekshApiPlugin()],
})
