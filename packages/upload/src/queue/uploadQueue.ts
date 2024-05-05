import axios, {
    AxiosHeaders,
    AxiosInstance,
    AxiosRequestConfig,
} from "axios";
import {
    ProgressContext,
    RequestLimit,
    UploadActions,
    UploadFile,
    UploadRawFile,
    UploadStatus,
    WorkerConfig,
} from "../interface";
import {
    RequestTask,
    UploadRequestQueue,
} from "./uploadRequestQueue";
import { UploadTask } from "./uploadTask";
import { genFileId } from "../utils";
import { TaskQueue } from "./TaskQueue.ts";

const DEFAULT_CHUNK_SIZE = 1024 * 1024;

export interface UploadQueueOptions {
    actions: UploadActions;
    /**
     * 是否携带cookie,默认false
     */
    withCredentials?: boolean;
    /**
     * 分片大小,默认1MB
     */
    chunkSize?: number;
    /**
     * 全局请求头,可用来设置token
     */
    headers?: AxiosHeaders;
    /**
     * 全局接口超时，默认10s(10*1000ms)
     */
    timeout?: number;
    /**
     * 接口并发数
     */
    requestLimit?: RequestLimit;
    /**
     * 文件并发上传数
     */
    parallel?: 1 | 2 | 3;
    /**
     * 重试次数，默认3次
     */
    maxRetries?: number;
    /**
     * worker线程配置
     */
    worker?: WorkerConfig;
    //TODO：文件上传总大小，速率、剩余耗时等
    /**
     * 进度回调
     * @param file 上传文件
     * @param percentage 进度
     */
    onProgress?: (
        percentage: number,
        file: UploadFile,
        context?: ProgressContext,
    ) => void;
}
export class UploadQueue {
    actions: UploadActions;
    defHttp: AxiosInstance;
    requestQueue: UploadRequestQueue;
    fileQueue: UploadFile[];
    taskQueue: UploadTask[];
    sliceQueue: TaskQueue;
    uploadingQueue: TaskQueue;
    private _options: UploadQueueOptions;
    constructor(options: UploadQueueOptions) {
        const {
            actions,
            chunkSize = DEFAULT_CHUNK_SIZE,
            parallel = 2,
            withCredentials = false,
            timeout = 10 * 1000,
            maxRetries = 3,
            headers,
            requestLimit = 6,
            worker = {},
        } = options;
        this._options = {
            ...options,
            chunkSize,
            parallel,
            withCredentials,
            timeout,
            maxRetries,
            requestLimit,
            worker,
        };
        this.actions = actions;
        this.fileQueue = [];
        this.taskQueue = [];
        this.sliceQueue = new TaskQueue(parallel);
        this.uploadingQueue = new TaskQueue(parallel);
        this.defHttp = axios.create({
            withCredentials,
            headers,
            timeout,
        });
        this.requestQueue = new UploadRequestQueue({
            parallel,
            requestLimit,
        });
    }

    /**
     * 全局请求封装
     * @param config 请求配置
     * @param upload 上传任务
     * @param openRetry 启动重试，默认true
     * @param retries 重试次数，默认3
     */
    request<T = any>(
        config: AxiosRequestConfig,
        upload: UploadTask,
        openRetry = true,
        retries = 3,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;
        const source = axios.CancelToken.source();
        const task: RequestTask<T> = () =>
            this.defHttp.request<T>({
                ...config,
                cancelToken: source.token,
            });
        task._source = axios.CancelToken.source();
        task._isOpenRetry = openRetry;
        task._retries = retries;
        return that.requestQueue.add(upload, task);
    }

    /**
     * 新增上传任务
     * @param file 原始文件
     */
    add(file: File) {
        //TODO:确定如果是同一个文件的处理方式
        const uploadFile = this.initFile(file);
        //新建上传任务
        const uploadTask = new UploadTask({
            file: uploadFile,
            uploadQueue: this,
            status: UploadStatus.WAITING,
            worker: this.options.worker,
        });
        //添加到任务队列
        this.taskQueue.push(uploadTask);
        //添加到切片任务队列
        return uploadTask.start();
    }

    /**
     * 上传文件初始化
     * @param file
     * @private
     */
    private initFile(file: File) {
        const uid = genFileId();
        const rawFile = file as UploadRawFile;
        rawFile.uid = uid;
        const chunkSize = this.options.chunkSize!;
        const uploadFile: UploadFile = {
            uid,
            name: file.name,
            size: file.size,
            chunkSize,
            total: Math.ceil(file.size / chunkSize),
            raw: rawFile,
            percentage: 0,
        };
        this.fileQueue.push(uploadFile);
        return uploadFile;
    }

    //这样的目的是防止外部修改options的值，但又保证配置可读取
    get options() {
        return this._options;
    }
}
