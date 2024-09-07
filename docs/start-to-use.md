---
layout: doc
---
# 简要说明
本章只做前端使用说明和后端的接口规范说明。

如果你需要了解具体的实现原理，请到[大文件上传实现原理]()章节；

如果你需要了解相关的配置项含义，请到[配置项](/config)章节。

#  安装
你可以使用 npm 引入本包

```bash
npm i @zfile/upload
```
# 使用
通过本包导出 `useFileUpload` 这个hook，并传入一些必要的配置项，并进一步
解构出 `upload`方法，用于后续具体的文件上传操作。

以下代码为最简单的使用方式：
```js
import {useFileUpload} from "@zfile/upload"
const {upload} = useFileUpload({
  actions: {
    baseURL: "http://localhost:3000/api",
    check: {
      action: '/check',
      method: 'post',
      transformData(file) {
        return {
          fileHash: file.hash
        }
      },
      transformResponse(response, chunks, file) {
        const data = response.data
        if (data.success) {
          return {
            success: true,
            response,
            uploadedChunks: chunks,
            chunks: []
          }
        }
        const list: { hash: string; index: number }[] =
          data.data?.map((item: Record<string, any>) => ({
            hash: item.chunk_hash,
            index: item.chunk_number
          })) ?? []
        list.sort((pre, cur) => pre.index - cur.index)
        const indexSet = new Set<number>()
        const hashSet = new Set<string>()

        for (let i = 0; i < list.length; i++) {
          indexSet.add(list[i].index)
          hashSet.add(list[i].hash)
        }
        const leftChunks = chunks.filter((chunk) => {
          return !(indexSet.has(chunk.index) && hashSet.has(chunk.hash as string))
        })
        const uploadedChunks = chunks.filter((chunk) => {
          return indexSet.has(chunk.index) && hashSet.has(chunk.hash as string)
        })
        const check = !leftChunks.length
        return {
          success: check,
          response,
          chunks: leftChunks,
          uploadedChunks
        }
      },
      transformError(error, isCancel) {
        return {
          success: false,
          error,
          isCancel
        }
      }
    },
    upload: {
      action: '/upload',
      method: 'post',
      transformData(chunk, file) {
        const formData = new FormData()
        formData.append('total', `${file.total}`)
        formData.append('chunkNumber', `${chunk.index}`)
        formData.append('chunkSize', `${chunk.size}`)
        formData.append('fileName', `${file.name}`)
        formData.append('fileSize', `${file.size}`)
        formData.append('fileHash', `${file.hash}`)
        formData.append('chunkHash', `${chunk.hash}`)
        return formData
      },
      transformResponse: (response) => {
        return {
          success: true,
          response
        }
      },
      transformError: (error, isCancel) => {
        return {
          success: false,
          error,
          isCancel
        }
      }
    },
    merge: {
      action: '/merge',
      method: 'post',
      transformData(file, chunks) {
        return {
          total: file.total,
          md5: file.hash,
          fileName: file.name
        }
      },
      transformResponse: (response) => {
        return {
          success: true,
          response
        }
      },
      transformError: (error, isCancel) => {
        return {
          success: false,
          error,
          isCancel
        }
      }
    }
  },
  onFileChange(file,files,type){
    //当文件确认上传或者删除文件时触发
  },
  onProgress(percentage,file,files){
    //文件进度改变时触发
  },
  onSuccess(file){
    //某个文件上传成功后触发
  }
})

//具体上传时，请获取到原生的File对象，通过下述的方式传入：
upload(file)
```

上述选项将在选项参数一章做具体的说明。

::: info
由于大文件上传需要使用 三个接口实现，具体请求参数要求和返回响应视具体的业务而定；
因此，本库将此部分的逻辑暴露出来，以实现整体大逻辑和具体业务上的解耦。
:::

# 数据库的设计
要实现完整的大文件上传，后端需要设计两张表，一张为切片表（chunk_list）,一张为文件表（file_list），相关字段如下表所示：

## 切片表

| 字段名       | 字段类型     | 含义                               |
| ------------ | ------------ | ---------------------------------- |
| id           | int          | 自增id                             |
| file_hash    | varchar(255) | 文件唯一hash                       |
| chunk_number | int          | 分片序号                           |
| file_name    | varchar(255) | 文件名                             |
| createdAt    | datetime     | 分片上传时间                       |
| chunk_total  | int          | 分片大小                           |
| total_size   | int          | 文件大小                           |
| chunk_hash   | varchar(255) | 全量内容计算hash，分片自己的hash值 |



## 文件表

| 字段名    | 字段类型     | 含义             |
| --------- | ------------ | ---------------- |
| id        | int          | 自增id           |
| file_hash | varchar(255) | 文件hash         |
| file_size | int          | 文件总大小       |
| file_name | varchar(255) | 文件名称         |
| createdAt | datetime     | 文件上传时间     |
| file_path | varchar(255) | 文件本地存放路径 |

# 接口设计

大文件上传需要三个接口 checkApi、uploadApi、和mergeApi，其作用分别是：检查分片上传完成情况和是否秒传、上传分片、合并上传的分片（或在秒传后上传一些业务字段）。

作者本人用`nodejs`写了一套API，并提交到了Github仓库，可以阅读我的后端代码来进一步设计自己的后端流程。

三个接口的请求和请求参数如下所示

## 检查接口

* 请求路径 /api/check

* 请求方法 post

* 请求对象（body application/json）

  | 字段     | 类型   | 含义         |
  | -------- | ------ | ------------ |
  | fileHash | string | 文件唯一hash |

  

* 请求响应（data application/json）

| 字段    | 类型     | 含义                                                   |
| ------- | -------- | ------------------------------------------------------ |
| success | boolean  | 文件是否已经上传并存在，true即是秒传                   |
| data    | number[] | 分片下标数组，用于前端判断哪些分片已经上传哪些还未上传 |



## 上传接口

* 请求路径 /api/upload
* 请求方法 post
* 请求对象（body. FormData）

| 字段        | 类型   | 含义          |
| ----------- | ------ | ------------- |
| total       | number | 文件总大小    |
| chunkNumber | number | chunk序号     |
| chunkSize   | number | chunk大小     |
| fileName    | string | 文件名        |
| fileSize    | number | 文件大小      |
| fileHash    | string | 文件的hash值  |
| chunkHash   | string | chunk的hash值 |
| file        | Blob   | chunk块       |

* 请求响应（data application/json）

  | 字段    | 类型    | 含义             |
  | ------- | ------- | ---------------- |
  | success | boolean | 切片是否上传成功 |
  | data    | null    | 预留返回数据     |

  

## 合并接口

* 请求路径 /api/merge

* 请求方法 post

* 请求对象（body application/json）

  | 字段     | 类型   | 含义             |
  | -------- | ------ | ---------------- |
  | total    | number | 合并的文件总大小 |
  | md5      | string | 合并的文件hash值 |
  | fileName | string | 合并的文件名     |

  

* 请求响应（data application/json）



| 字段    | 类型    | 含义             |
| ------- | ------- | ---------------- |
| success | boolean | 文件合并是否成功 |

