import { fileURLToPath, URL } from 'node:url'
import Unocss from 'unocss/vite'
import Components from 'unplugin-vue-components/vite'
import VxeTableResolver from '@vxecli/import-unplugin-vue-components'
import { createStyleImportPlugin } from 'vite-plugin-style-import'
import VxeTableResolve from '@vxecli/import-vite-plugin-style-import'
import { createHtmlPlugin } from 'vite-plugin-html'

import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import VueDevTools from 'vite-plugin-vue-devtools'

const CWD = process.cwd()
// https://vitejs.dev/config/
export default defineConfig((config) => {
  const { command, mode } = config
  // 环境变量
  const { VITE_BASE_URL, VITE_DROP_CONSOLE, VITE_TITLE } = loadEnv(mode, CWD)
  return {
    base: VITE_BASE_URL,
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
      }),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            title: VITE_TITLE
          }
        }
      })
      // viteExternalsPlugin({
      //   SparkMD5: 'SparkMD5'
      // })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    //优化
    optimizeDeps: {
      include: []
    },
    esbuild: {
      // pure: VITE_DROP_CONSOLE ? ['console.log', 'debugger'] : []
    },
    //构建目标
    build: {
      target: 'es2017',
      minify: 'esbuild',
      cssTarget: 'chrome79',
      chunkSizeWarningLimit: 2000,
      outDir: 'dist'
    }
  }
})
