import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "zfile-大文件上传",
  description: "一站式开箱大文件上传，不依赖任何前端框架",
  metaChunk:true,
  base:"/zfile/",
  themeConfig:{
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: '配置项', link: '/config' },
      {text:'实现原理',link:'/how-to-implement'}
    ],
    outline:{
      level:[1,6],
    },

    sidebar:[

    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zerotower69/zfile' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present zerotower'
    }
  },
  outDir:".vitepress/dist",
  vite:{
    server:{
      port:8000
    }
  }
})
