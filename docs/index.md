---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "zfile"
  text: "大文件上传"
  tagline: 无烦恼使用大文件上传
  actions:
    - theme: brand
      text: 开始使用
      link: /start-to-use
    - theme: alt
      text: 配置说明
      link: /config

features:
  - title: 无框架依赖💧
    details: 纯粹的JavaScript逻辑核心实现，不和任何前端框架耦合
  - title: 请求优化😊
    details: 大文件上传和下载请求时限制最大并发数，请求失败时再次重试
  - title: 任务调度🔥
    details: 可以随时暂停、恢复、取消大文件的上传和下载
  - title: 多线程 🚀
    details: 利用WebWorker优化大文件的唯一hash计算
---

