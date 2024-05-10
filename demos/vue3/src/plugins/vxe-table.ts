//@ts-ignore
import XEUtils from 'xe-utils'
import type { App } from 'vue'
import { VXETable, VxeTable, VxeColumn, VxeButton, VxeModal } from 'vxe-table'
import zhCN from 'vxe-table/es/locale/lang/zh-CN'
// 导入主题变量，也可以重写主题变量
import 'vxe-table/styles/cssvar.scss'
import 'vxe-table/styles/v-x-e-table.scss'
VXETable.config({
  i18n: (key, args) => XEUtils.toFormatString(XEUtils.get(zhCN, key), args)
})

export function setupVxeTable(app: App) {
  app.use(VxeTable)
  app.use(VxeColumn)
  app.use(VxeButton)
  app.use(VxeModal)
}
