import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "zfile-大文件上传和下载",
  description: "一站式开箱大文件上传和下载，不依赖任何前端框架",
  metaChunk:true,
  base:"/zfile/",
  head:[
    ['link',{rel:"icon",href:"./logo.svg"}]
  ],
  themeConfig:{
    logo:"/logo.svg",
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: '在线示例', link: '/demos' }
    ],

    sidebar:[
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zerotower69/zfile' }
    ]
  },
  outDir:"./dist",
  vite:{
    server:{
      port:8000
    },
  }
})
