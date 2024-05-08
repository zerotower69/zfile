import { createApp } from 'vue'
import App from './App.vue'
import { setupVxeTable } from '@/plugins/vxe-table'
import './assets/main.css'
import 'virtual:uno.css'

const app = createApp(App)
setupVxeTable(app)
app.mount('#app')
