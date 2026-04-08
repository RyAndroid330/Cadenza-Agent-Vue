// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  components: {
    dirs: [
      { path: '~/components', pathPrefix: false }
    ]
  },
  nitro: {
    devServer: {
      host: '0.0.0.0'
    }
  },
  vite: {
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3010',
          changeOrigin: true,
          ws: true
        }
      }
    }
  }
})
