<div align="center"> <a href="https://github.com/zerotower69/zfile" style="text-decoration: none">
<img src="./ZFILE.svg" alt="zfile"/>
</a> <br> <br>

[![license](https://img.shields.io/github/license/anncwb/vue-vben-admin.svg)](LICENSE)
[![qq](https://img.shields.io/badge/QQ-876822711-blue)](https://qm.qq.com/q/wDaVQV2ddC)

</div>

## 介绍
> zfile集成了大文件上传和下载，前端只需要引入相关库包，后端遵循相应地接口规范，即可实现快速集成。

## 特性
- **无框架依赖🍎**：纯粹的JavaScript逻辑核心实现，不和任何前端框架耦合
- **请求优化😊**：大文件上传和下载请求时限制最大并发数，请求失败时再次重试
- **任务调度🔥**：可以随时暂停、恢复、取消大文件的上传和下载
- **多线程 🚀**：利用WebWorker优化大文件的hash计算

## 文档和预览

文档部署在**github pages**,[点击这里查看](https://zerotower69.github.io/zfile/).


## 安装和使用

- 获取代码
```bash
git clone https://github.com/zerotower69/zfile.git
```
- 安装依赖

**请注意：本项目的包管理工具为pnpm，版本>=8.10.0，node版本>=18.12.0**

```bash
cd zfile

pnpm install -w

```

- 运行命令
```bash

pnpm server:start #开启后端

pnpm docs:dev #启动文档

pnpm demo:dev #启动示例

```

## Browser support

The `Chrome 80+` browser is recommended for local development

Support modern browsers, doesn't include IE

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt=" Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>IE | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt=" Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Safari |
| :-: | :-: | :-: | :-: | :-: |
| not support | last 2 versions | last 2 versions | last 2 versions | last 2 versions |

## 提交Bug

请通过[issues](https://github.com/zerotower69/zfile/issues)向我提交，并尽量给出复现步骤，搭配的后端请使用本项目提供的后端服务（node.js 搭建）。

## License

[MIT © zfile-2024](./LICENSE)


