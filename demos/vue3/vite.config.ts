import { fileURLToPath, URL } from 'node:url'
import Unocss from 'unocss/vite'
import Components from 'unplugin-vue-components/vite'
import VxeTableResolver from '@vxecli/import-unplugin-vue-components'
import { createStyleImportPlugin } from 'vite-plugin-style-import'
import VxeTableResolve from '@vxecli/import-vite-plugin-style-import'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 8000,
    hmr: true
  },
  plugins: [
    vue(),
    vueJsx(),
    VueDevTools(),
    Unocss(),
    Components({
      resolvers: [VxeTableResolver()]
    }),
    createStyleImportPlugin({
      resolves: [VxeTableResolve()]
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
