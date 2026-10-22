import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nirpekshApiPlugin } from './server/api-plugin'

export default defineConfig({
  plugins: [react(), nirpekshApiPlugin()],
})
