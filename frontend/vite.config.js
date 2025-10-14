
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: 5175 },
  define: {
    __API__: JSON.stringify(process.env.VITE_API || 'http://localhost:3000')
  }
})
