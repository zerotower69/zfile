// uno.config.ts
import { defineConfig, presetAttributify, presetUno, presetIcons } from 'unocss'
// loader helpers
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

//@ts-ignore
export default defineConfig({
  shortcuts: {
    'f-c-c': 'flex justify-center items-center'
  },
  presets: [
    presetAttributify({
      /* preset options */
    }),
    presetUno(),
    presetIcons({
      collections: {
        carbon: () => import('@iconify-json/carbon/icons.json').then((i) => i.default),
        custom: FileSystemIconLoader('./src/assets/icons', (svg) =>
          svg.replace(/#fff/, 'currentColor')
        )
      }
    })
  ]
})
