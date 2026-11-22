import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' = load every var, not just VITE_*, so VITE_API_PROXY works from .env.local.
  const env = loadEnv(mode, '.', '')
  const target = env.VITE_API_PROXY || 'https://studia-api-mu.vercel.app'

  return {
    plugins: [react()],
    server: {
      // Dev only. With VITE_API_URL empty the browser calls /api on this same origin, so there is
      // no cross-origin request and no CORS check at all; Vite forwards it to studia-api from
      // Node. The deployed admin site still needs its origin in the API's ALLOWED_ORIGINS.
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            // studia-api only echoes Access-Control-Allow-Origin for allow-listed origins and
            // ignores the header otherwise, so drop it and look like a native client.
            proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
          },
        },
      },
    },
  }
})
