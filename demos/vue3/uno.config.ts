// uno.config.ts
import { defineConfig, presetIcons, presetAttributify, presetUno } from 'unocss'
// loader helpers
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

//@ts-ignore
export default defineConfig({
  presets: [
    presetAttributify({
      /* preset options */
    }),
    presetUno(),
    presetIcons({
      collections: {
        custom: FileSystemIconLoader('./assets/icons', (svg) => svg.replace(/#fff/, 'currentColor'))
      }
    })
  ]
})
