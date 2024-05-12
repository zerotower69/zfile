import axios, {
    AxiosInstance,
    AxiosRequestConfig,
} from "axios";
import {
    UploadActions,
    UploadFile,
    UploadQueueOptions,
    UploadRawFile,
    UploadStatus,
} from "../interface";
import {
    RequestTask,
    UploadRequestQueue,
} from "./uploadRequestQueue";
import { UploadTask } from "./uploadTask";
import { genFileId } from "../utils";
import { TaskQueue } from "./TaskQueue";
import { isObject } from "lodash-es";
import humanFormat from "human-format";

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
export class UploadQueue {
    actions: UploadActions;
    defHttp: AxiosInstance;
    requestQueue: UploadRequestQueue;
    fileQueue: UploadFile[];
    taskQueue: UploadTask[];
    sliceQueue: TaskQueue;
    uploadingQueue: TaskQueue;
    private readonly _options: UploadQueueOptions;
    isOffline: boolean;
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
        this.isOffline = window.navigator.onLine;
        window.addEventListener("offline", this.offline);
        window.addEventListener("online", this.online);
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
        task._url = config.url;
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
        const promise = uploadTask.start();
        this.options.onFileChange(
            uploadFile,
            this.fileQueue,
            "add",
        );
        return {
            task: uploadTask,
            file: uploadFile,
            promise,
        };
    }

    remove(file: number | UploadFile) {
        const id = isObject(file) ? file.uid : file;
        const index = this.fileQueue.findIndex(
            (item) => item.uid === id,
        );
        if (index > -1) {
            const uploadFile = this.fileQueue[index];
            uploadFile.task.stop("移除任务");
            const taskIndex = this.taskQueue.findIndex(
                (item) => item.id === uploadFile.task.id,
            );
            if (taskIndex > -1) {
                this.taskQueue.splice(taskIndex, 1);
            }
            this.fileQueue.splice(index, 1);
            setTimeout(() => {
                this.options?.onFileChange(
                    uploadFile,
                    this.fileQueue,
                    "remove",
                );
            }, 0);
            return true;
        }
        return false;
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
            humanSize: humanFormat(file.size),
            chunkSize,
            total: Math.ceil(file.size / chunkSize),
            raw: rawFile,
            percentage: 0,
            uploaded: 0,
            status: UploadStatus.WAITING,
        };
        Object.defineProperty(uploadFile, "humanSize", {
            get() {
                return humanFormat(uploadFile.size);
            },
        });
        this.fileQueue.push(uploadFile);
        return uploadFile;
    }

    //这样的目的是防止外部修改options的值，但又保证配置可读取
    get options() {
        return this._options;
    }
    private offline() {
        this.isOffline = true;
        this.options?.onOffline?.(this.fileQueue);
    }
    private online() {
        this.isOffline = false;
        //重启断网后终止的任务
        const offlineTasks = this.taskQueue.filter(
            (task) => task.status === UploadStatus.OFFLINE,
        );
        offlineTasks.forEach((task) => {
            task.start();
        });
        this.options?.onLine?.(this.fileQueue);
    }
}
