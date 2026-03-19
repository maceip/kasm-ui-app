import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// https://vite.dev/config/
export default defineConfig({
  plugins: [solid()],
  base: process.env.GITHUB_ACTIONS ? '/kasm-ui-app/' : '/',
  preview: {
    allowedHosts: true,
  },
})
