# actions

* 类型：`UploadActions`
* 是否必要：是



## actions.baseURL

* 类型：string

全局请求基本地址

上传行为配置，各个的接口路径，请求方法，请求参数，响应转换回调、错误处理回调等。

## actions.check

* 类型：`UploadActions`
* 是否必要：`是`

检查接口相关配置项

### actions.check.action

### actions.check.method

### actions.check.headers

### actions.check.transformParams(file)

### actions.check.transformResponse

### actions.check.transformError

### actions.check.timeout

### actions.check.retries



## actions.upload

### actions.upload.action

### actions.upload.method

### actions.upload.headers

### actions.upload.file

### actions.upload.transParams()

### actions.upload.transforDate()

### actions.upload.transformResponse()

### actions.upload.transformError()

### actions.upload.timeout

### actions.upload.retries

### actions.upload.onProgress()



## actions.merge

### actions.merge.action 

### actions.merge.method

### actions.merge.headers

### actions.merge.transformParams()

### actions.merge.transformData()

### actions.merge.transformResponse()

### actions.merge.transformError()

### actions.merge.timeout

### actions.merge.retries

# withCredentials

* 类型：`boolean`
* 默认值：`false`
* 是否必要：`否`

上传请求是否携带cookie

# chunkSize

* 类型：`number`
* 默认值：`1024*1024`
* 单位：`byte(字节)`
* 是否必要：`否`

固定切片时每一块切片的大小，最后一块切片可能比其还要小。

# headers

* 类型：`RawAxiosRequestHeaders`|`()=>RawAxiosRequestHeaders`
* 默认值：`undefined`
* 必要参数：`否`

用于设置全局请求中额外的请求头，例如，可以设置token

```javascript
upload({
  headers:()=>{
    ...
    return {
      Authorization:"bear xxx"
    }
  }
})
```



# timeout

* 类型：`number`
* 默认值：`10*1000`
* 单位：`ms`
* 可选参数：否

全局超时设置，用于`axios`的timeout。

# reuqestLimit

* 类型：`1|2|3|4|5|6`
* 默认值：`6`
* 是否必选：`否`

接口并发最大数量。

# parallel

* 类型：`1|2|3`
* 默认值： `3`
* 是否必选：`否`

最大并发上传大文件的数量，当正处于上传状态的文件数量（排除取消和暂停的文件）小于此值时，取上传状态的文件数量作为并发值。

# maxRetries

* 类型：`number`
* 默认值：`3`
* 是否必须：`否`

接口发生错误后的请求次数（含本来请求数）。当一个接口请求失败后会重新发起请求，直到连续`maxRetries`次失败后，该请求才算真正意义上的失败。虽然手动取消接口请求也会导致请求报错，但内部通过`axios`提供的接口也能判断出是否是取消导致的报错（Promise为rejected），该情况将不会被统计。

# worker

* 类型：`WorkerConfig`
* 是否必选：`否`

WebWorker 工作者线程的相关配置选项。

## worker.thread

* 类型：`number`
* 默认值：`Math.min(4,navigator.hardwareConcurrency)`
* 必选参数：`否`

每个文件切片计算唯一`Hash`值最多开启的工作线程的数量，实际上具体数量取决的浏览器可使用的具体内核数。

## worker.paraller

* 类型：`number`
* 默认值：`2`
* 必选参数：`否`

最多允许同时切片的文件数量，相对应地，总开启的最大工作者线程的数量，记为：`threadNum = worker.thread*worker.paraller`。

## worker.timeout

* 类型：`number`
* 默认值：`300*1000`
* 单位： `ms`
* 必选参数：`否`

计算Hash值的线程超时，超过此值还未能计算出文件Hash，视为整体上传错误，并中断后续所有的流程。

## worker.spark_md5_url

* 类型：`string`
* 默认值：`https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M/spark-md5/3.0.2/spark-md5.min.js`
* 必选参数：`否`

由于计算文件Hash依赖于`SparkMD5.js`这个库包，且WebWorker中只能通过`importScripts()`的方式导入相应的依赖。当项目一直处于公网环境下，也就是说支持CDN的方式，可以使用默认的CDN地址，默认地址属于字节跳动的CDN，经测试是比较可靠稳定的。如果你无法支持CDN，先将相关的`spark-md5.js`文件放入在静态资源文件夹内，然后通过类似于 new URL().href的方式使用，以确保项目部署后，该`spark-md5.js`文件能正常访问（浏览器能打开访问）。

```javascript
upload({
  worker:{
    spark_md5_url :new URL('xxx-sparkMD5.js').href
  }
})
```



::: warning

请注意项目部署在二级路径或者多级路径的情况，确保该js文件的访问路径正确无误。

:::

# onProgress(percentage,file,files,event)

* percentage: `number` 百分比，小数
* file :`UploadFile` 包装的上传文件对象
* files: `UploadFile[]` 所有上传的文件列表
* event: `UploadProgressEvent` 自定义上传进度事件对象

文件上传进度时，调用该回调函数。

# onFileChange(file,files,type)

* file `UpploadFile`
* files `UploadFiles[]`
* type `"add"|"remove"`

用于监听文件变化，当前支持“add”和“remove”。

# onSuccess(file)

* file `UploadFile`

当文件上传成功后触发的钩子。

# onStatusChange(status,oldStatus,file)

* status `UploadStatus`
* oldStatus `UploadStatus`
* file `UploadFile`

当文件对应的状态变更时，调用该回调函数。

所有UploadStatus定义的状态有：

| 状态 | 含义 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |
|      |      |
|      |      |

# onSliceStart(file,files)

* file `UploadFile`
* files `UploadFile[]`

该回调在开始正式切片时被调用。

# onSliceEnd(file,files)

* file `UploadFile`
* files `UploadFile[]`

该回调在切片完成后被调用。

# onSliceError(error,file,files)

该回调在切片发生错误时被调用。

# onUploadStart(file,files)

在请求接口前执行的回调函数。

# onUploadError(error,file,files)

通过接口上传途中发生错误，调用该回调函数。

# onOffline(files)

* files `UploadFIle[]`

网络中断时会触发该回调函数。

# onLine(files)

网络从“off”变为“online”调用的回调函数。

# onCancel(message,file,files)

* message `string` 取消的理由
* file `UploadFile`
* files `UploadFiles[]`

取消上传调用的回调。

# onSkipUpload(file,files)

* file `UploadFile`
* files `UploadFile[]`

秒传之后会调用的回调函数。你可以在该回调函数里继续发起请求，以便将上传一些其他的业务需求字段和上传的文件所绑定。该回调函数只有在`stillMergeAfterSkip：false`才会生效。

# stillMergeAfterSkip

* 类型：`boolean`
* 默认值：`false`

秒传后是否继续调用merge API，以便实现