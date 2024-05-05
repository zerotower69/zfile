import { BigFileRequestError, FileStatus, UploadChunk, UploadFile } from "../interface.ts";
import { RequestQueueOptions, UploadActions } from "../request/interface.ts";
import { SuperTask } from "./superTask.ts";
import { getCheckChunkApi, getMergeChunkApi, getUploadChunkApi, retryAsyncFn } from "../request/api.ts";
import { useSliceFile, UseSliceFileReturn } from "../slice.ts";
import { getConcurrency, getError, transformError } from "../helpers.ts";
import { FileTaskQueue } from "./FileTaskQueue.ts";
import axios, { AxiosInstance, AxiosRequestConfig, CancelTokenSource } from "axios";
import { FileQueue } from "./FileQueue.ts";
import { debounce } from "lodash-es";

let taskId = 1;
export interface FileTaskOption {
    file: UploadFile;
    onChangeStatus?: (file: UploadFile, status?: FileStatus, oldStatus?: FileStatus) => void;
    actions: UploadActions;
    requestConfig: RequestQueueOptions;
    taskQueue: FileTaskQueue;
    fileQueue: FileQueue;
    maxRetries?: number;
    parallel?: number;
    thread?: number;
}

/**
 * 单个文件上传的任务调度
 */
export class FileTask {
    id: number;
    _options: FileTaskOption;
    superTask: SuperTask;
    private _defHttp: AxiosInstance;
    source: CancelTokenSource;
    file: UploadFile;
    sliceContext: UseSliceFileReturn;
    taskQueue: FileTaskQueue;
    fileQueue: FileQueue;
    _maxRetries: number;
    private _retries: number;
    private _runP?: Promise<void>;
    private _runResolve?: (value?: any | PromiseLike<any>) => void;
    //@ts-ignore
    private _runReject?: (reason?: any) => void;
    private _running: boolean;
    constructor(options: FileTaskOption) {
        const { file, parallel = 6, requestConfig, thread = 4, taskQueue, fileQueue, maxRetries = 3 } = options;
        const maxThread = Math.min(getConcurrency(), thread);
        this._options = options;
        this.id = taskId++;
        this._retries = 0;
        this._running = false;
        this._maxRetries = Math.max(1, maxRetries);
        this.file = file;
        this.superTask = new SuperTask(Math.max(1, parallel));
        this._defHttp = axios.create(requestConfig);
        this.source = axios.CancelToken.source();
        this.sliceContext = useSliceFile(file, maxThread);
        this.taskQueue = taskQueue;
        this.fileQueue = fileQueue;
    }
    get options() {
        return this._options;
    }
    get actions() {
        return this._options.actions;
    }
    get status() {
        return this.file.status;
    }
    /**
     * 改变当前文件状态
     * @param status
     */
    set status(status: FileStatus) {
        if (this.status === status) {
            return;
        }
        switch (this.status) {
            //都上传成功了，不需要再次变更
            case FileStatus.SUCCESS:
                return;
        }
        this.options?.onChangeStatus?.(this.file, status, this.status);
        this.file.status = status;
        // eslint-disable-next-line no-empty
        switch (
            status
            //TODO:干点别的什么
        ) {
        }
    }
    get requestQueue() {
        return this.taskQueue.requestQueue;
    }

    /**
     * 发送请求
     * @param config
     */
    request<T = any>(config: AxiosRequestConfig) {
        config.cancelToken = this.source.token;
        const that = this;
        return function () {
            const p = that._defHttp.request<T>(config);
            //TODO:区分自定义取消请求和被浏览器取消请求
            const newP = p.then(
                (value) => value,
                (reason) => {
                    throw reason;
                },
            );
            return newP;
        };
    }

    get chunks() {
        return this.file.chunks!;
    }
    set chunks(val) {
        this.file.chunks = val;
    }
    get checkChunkApi() {
        return getCheckChunkApi(this.actions.check, this);
    }
    get uploadChunkApi() {
        return getUploadChunkApi(this.actions.upload, this);
    }
    get mergeChunkApi() {
        return getMergeChunkApi(this.actions.merge, this);
    }

    /**
     * 上传多个切片
     * @param chunks
     */
    uploadChunks(chunks: UploadChunk[]) {
        this.status = FileStatus.UPLOADING;
        let currentIndex = 0;
        const tasks = [];
        while (currentIndex < chunks.length) {
            const chunk = chunks[currentIndex];
            tasks.push(
                this.uploadChunkApi(chunk, this.file, (percentage, chunk) => {
                    this.onChunkProgress(percentage, chunk as UploadChunk);
                }),
            );
            currentIndex++;
        }
        return Promise.all(tasks);
    }

    private onChunkProgress(percentage: number, chunk: UploadChunk) {
        chunk.percentage = percentage;
        debounceUpdateProgress(this);
    }

    updateFileProgress(percentage: number) {
        console.log(percentage);
    }

    /**
     * 任务开始
     */
    async start() {
        if (this._running) {
            return false;
        }
        this._running = true;
        this._retries = 0;
        const p = new Promise<void>((resolve, reject) => {
            this._runResolve = resolve;
            this._runReject = reject;
        });
        this._runP = p;
        try {
            await this.startSlice();
        } catch (e: any) {
            this._runReject?.(transformError(e));
        }
        console.log("切片完成", this.status);
        this.status = FileStatus.READY;
        if (this._running) {
            try {
                this.startUpload();
            } catch (e) {
                /* empty */
            }
        } else {
            this._runResolve?.("任务暂停");
        }
        return p;
    }

    startSlice() {
        return this.taskQueue.sliceQueue.add(() => {
            console.log("准备切片", this.status);
            if (this.status === FileStatus.WAITING) {
                this.status = FileStatus.READING;
                return this.sliceContext
                    ?.start?.()
                    .then((data) => {
                        console.log("切片成功", data);
                        this.status = FileStatus.READY;
                        this.file.hash = data.fileHash;
                        this.chunks = data.fileChunks;
                    })
                    .catch((reason) => {
                        this.status = FileStatus.FAIL;
                        throw reason;
                    });
            }
            return true;
        });
    }
    cancelSlice() {
        this.sliceContext?.stop?.();
    }

    startUpload() {
        const that = this;
        return this.taskQueue.uploadQueue.add(async () => {
            if (this.status === FileStatus.WAITING) {
                this._runReject!(getError("文件未切片"));
                return this._runP;
            }
            let check: UploadChunk[];
            try {
                check = await retryAsyncFn(() => this.checkChunkApi(this.file, this.chunks), this._maxRetries);
            } catch (e) {
                this.status = FileStatus.FAIL;
                this._runReject?.(transformError(e, "检查分片接口失败"));
                return this._runP;
            }
            if (!check.length) {
                //第一遍就是秒传
                this.status = FileStatus.SUCCESS;
                this._runResolve?.("文件上传成功");
                return this._runP;
            }

            let chunks = check as UploadChunk[];

            async function recursiveFn() {
                try {
                    await that.uploadChunks(chunks);
                    chunks = await that.checkChunkApi(that.file, that.chunks);
                    if (chunks.length) {
                        throw Error;
                    } else {
                        return true;
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
            }
            try {
                await retryAsyncFn(recursiveFn, this._maxRetries);
            } catch (e) {
                this.status = FileStatus.FAIL;
                this._runReject?.(transformError(e, "文件上传失败"));
                return this._runP;
            }
            let merge: boolean;
            try {
                merge = await retryAsyncFn(() => that.mergeChunkApi(that.file, that.chunks), that._maxRetries);
            } catch (e) {
                this.status = FileStatus.FAIL;
                this._runReject?.(transformError(e, "文件合并接口失败"));
                return this._runP;
            }
            if (merge) {
                this.status = FileStatus.SUCCESS;
                this._runResolve?.("文件上传成功");
                return this._runP;
            } else {
                this.status = FileStatus.FAIL;
                this._runReject?.(getError("文件合并失败"));
                return this._runP;
            }
        });
    }

    /**
     * 任务结束
     */
    stop(status: FileStatus, error = new BigFileRequestError("未知错误")) {
        if ([FileStatus.READY, FileStatus.WAITING, FileStatus.UPLOADING].includes(status)) return;
        if (this._running) {
            this.status = status;
            this.taskQueue.remove(this);
            this._running = false;
            switch (status) {
                case FileStatus.SUCCESS:
                    this._runResolve?.();
                    break;
                case FileStatus.PENDING:
                    this._runReject?.();
                    break;
                case FileStatus.FAIL:
                    this._runReject?.(error);
                    break;
                default:
                    this._runResolve?.();
            }
            this._runResolve = void 0;
            this._runReject = void 0;
            if (status !== FileStatus.SUCCESS) {
                this.cancelSlice();
                this.cancelUpload();
            }
            return this._runP as Promise<void>;
        }
        return Promise.resolve();
    }

    addRetries() {
        if (this._retries >= this._maxRetries) {
            this.stop(FileStatus.FAIL);
        } else {
            this._retries++;
        }
    }
    cancelUpload() {
        this.source.cancel();
        this.source = axios.CancelToken.source();
    }
}

function updateFileProgress(task: FileTask) {
    let count = 0;
    for (let i = 0; i < task.chunks.length; i++) {
        const getChunk = task.chunks[i];
        const percentage = getChunk?.percentage ?? 0;
        count += Math.round(getChunk.size * percentage);
    }
    const filePercentage = Math.round((Math.min(task.file.size, count) / task.file.size) * 100) / 100;
    task.updateFileProgress(filePercentage);
}

const debounceUpdateProgress = debounce(updateFileProgress, 20);
