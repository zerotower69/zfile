// uno.config.ts
import { defineConfig, presetIcons } from 'unocss'
// loader helpers
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

//@ts-ignore
export default defineConfig({
  presets: [
    presetIcons({
      collections: {
        custom: FileSystemIconLoader('./assets/icons', (svg) => svg.replace(/#fff/, 'currentColor'))
      }
    })
  ]
})
