import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "zfile-大文件上传和下载",
  description: "一站式开箱大文件上传和下载，不依赖任何前端框架",
  metaChunk:true,
  base:"/zfile/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: '在线示例', link: '/markdown-examples' }
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zerotower69/zfile' }
    ]
  },
  outDir:"./dist",
  vite:{
    server:{
      port:8000
    }
  }
})
