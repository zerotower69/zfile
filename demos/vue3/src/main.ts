import './assets/main.css'
import 'virtual:uno.css'
import { createApp } from 'vue'
import App from './App.vue'
import { setupVxeTable } from '@/plugins/vxe-table'

const app = createApp(App)
setupVxeTable(app)
app.mount('#app')
