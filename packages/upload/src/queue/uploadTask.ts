import humanFormat from "human-format";
import {
    UploadApiReturn,
    UploadChunk,
    UploadFile,
    UploadProgressEvent,
    UploadStatus,
    WorkerConfig,
} from "../interface";
import { UploadQueue } from "./uploadQueue";
import {
    getCheckChunkApi,
    getMergeChunkApi,
    getUploadChunkApi,
} from "../api";
import { useSliceFile, UseSliceFileReturn } from "../slice";
import {
    asyncApply,
    BigFileError,
    debugWarn,
    getError,
    isCancel,
    syncApply,
    transformError,
} from "../utils";

let taskId = 1;
export interface UploadTaskOptions {
    file: UploadFile;
    uploadQueue: UploadQueue;
    status: UploadStatus;
    onChangeStatus?: (
        file: UploadFile,
        status?: UploadStatus,
        oldStatus?: UploadStatus,
    ) => void;
    maxRetries?: number;
    worker?: WorkerConfig;
}

/**
 * 文件上传任务，用于单个文件的调度
 */
export class UploadTask {
    //任务id,唯一
    id: number;
    //上传队列
    uploadQueue: UploadQueue;
    //上传文件对象
    file: UploadFile;
    private sliceContext?: UseSliceFileReturn;
    private readonly _options: UploadTaskOptions;
    private _runP?: Promise<void>;
    private _runResolve?: (
        value?: any | PromiseLike<any>,
    ) => void;
    private _uploadedChunks: UploadChunk[];
    //@ts-ignore
    private _runReject?: (reason?: any) => void;
    private _running: boolean;
    private _uploadTime?: number;
    private _sliced: boolean;
    //@ts-ignore
    private _canceled: boolean;
    //@ts-ignore
    private isFinished: boolean;
    /**
     * 上传速率 xx/s
     */
    rate: string;
    /**
     * 上传剩余时间，s
     */
    leftTime: number;
    constructor(options: UploadTaskOptions) {
        const {
            uploadQueue,
            file,
            status,
            maxRetries = 3,
        } = options;
        this._options = {
            ...options,
            status,
            maxRetries,
        };
        this.id = taskId++;
        this.uploadQueue = uploadQueue;
        this.file = file;
        this.file.task = this;
        this.file.status = status;
        this._running = false;
        this.uploadedSize = 0;
        this._uploadedChunks = [];
        this._sliced = false;
        this._canceled = false;
        this.isFinished = false;
        this.rate = "";
    }

    /**
     * 开始切片
     */
    private startSlice() {
        this.setSliceContext();
        this.status = UploadStatus.WAITING;
        //由于切片使用worker线程，使用并发控制，防止多文件上传时产生多个线程
        return this.uploadQueue.sliceQueue.add(async () => {
            if (!this._sliced) {
                //只有没有切片才进入切片
                this.status = UploadStatus.READING;
                try {
                    //切片前执行回调
                    syncApply(
                        this.uploadQueue.options
                            .onSliceStart,
                        [this.file, this.files],
                        this.running,
                    );
                    const data =
                        await this.sliceContext.start();
                    this.file.hash = data.fileHash;
                    this.file.chunks = data.fileChunks;
                    this._sliced = true;
                    //切片成功后执行回调
                    syncApply(
                        this.uploadQueue.options.onSliceEnd,
                        [this.file, this.files],
                        this.running,
                    );
                    return {
                        skip: false,
                        data: data,
                    };
                } catch (error: any) {
                    if (error.isCancel) {
                        const newError = getError(
                            "用户取消",
                            true,
                        );
                        debugWarn(newError);
                        throw newError;
                    } else {
                        const newError =
                            transformError(error);
                        debugWarn(newError);
                        throw newError;
                    }
                }
            } else {
                return {
                    skip: true,
                    data: null,
                };
            }
        });
    }

    /**
     * 取消切片
     */
    private cancelSlice() {
        this.sliceContext.stop();
    }

    /**
     * 启动上传
     * @private
     */
    private startUpload() {
        return this.uploadQueue.uploadingQueue.add(
            async () => {
                syncApply(
                    this.uploadQueue.options.onUploadStart,
                    [this.file, this.files],
                    this.running,
                );
                if (!this._sliced) {
                    const error = getError("文件未切片");
                    syncApply(
                        this.uploadQueue.options
                            .onUploadError,
                        [error, this.file, this.files],
                        this.running,
                    );
                    throw error;
                }
                //检查文件上传完成没有
                const check = await this.checkChunkApi(
                    this.file,
                    this.chunks,
                );
                if (check.isCancel || this._canceled) {
                    //取消上传
                    this._canceled = true;
                    throw getError("check上传取消", true);
                } else if (check.error) {
                    this._canceled = true;
                    throw transformError(check.error);
                } else if (check.success) {
                    //秒传
                    this.status = UploadStatus.MERGING;
                    //还得调用一次merge
                    const merge = await this.mergeChunkApi(
                        this.file,
                        this.chunks,
                    );
                    if (merge.isCancel || this._canceled) {
                        this._canceled = true;
                        this.status = UploadStatus.CANCEL;
                        throw getError("取消操作", true);
                    }
                    if (!merge.success) {
                        throw transformError(merge.error);
                    }
                    this.uploadedSize = this.file.size;
                    return;
                }
                const waitingChunks = check.chunks!;
                if (check.uploadedChunks) {
                    this.uploadedChunks =
                        check.uploadedChunks;
                }
                try {
                    await this.uploadChunks(waitingChunks);
                } catch (error) {
                    throw transformError(error);
                }
                const checkAgain = await this.checkChunkApi(
                    this.file,
                    this.chunks,
                );
                if (checkAgain.isCancel || this._canceled) {
                    //取消上传
                    this._canceled = true;
                    throw getError("上传取消", true);
                } else if (checkAgain.error) {
                    //检查接口错误
                    throw transformError(check.error);
                } else if (
                    !checkAgain.success ||
                    checkAgain.chunks!.length !== 0
                ) {
                    //未知错误
                    throw getError("发生错误");
                }
                this.status = UploadStatus.MERGING;
                //开始合并
                const mergeChunks =
                    await this.mergeChunkApi(
                        this.file,
                        this.chunks,
                    );
                if (
                    mergeChunks.isCancel ||
                    this._canceled
                ) {
                    throw getError("合并前上传取消", true);
                }
                if (mergeChunks.error) {
                    //合并接口错误
                    throw transformError(mergeChunks.error);
                }
                if (!mergeChunks.success) {
                    //未知错误
                    throw getError("发生错误");
                }
                //合并成功
                return;
            },
        );
    }

    /**
     * 取消上传
     */
    private cancelUpload(message = "手动取消") {
        this.uploadQueue.requestQueue.cancelUpload(
            this,
            message,
        );
    }

    private setSliceContext() {
        this.sliceContext = useSliceFile(
            this.file,
            this.options?.worker?.thread ?? 4,
            this.options?.worker?.timeout,
            this.options?.worker?.spark_md5_url,
        );
    }

    /**
     * 开始运行
     */
    async start() {
        if (this.running) {
            //禁止重复运行
            return false;
        }
        this._canceled = false;
        this.running = true;
        const p = new Promise<void>((resolve, reject) => {
            this._runResolve = resolve;
            this._runReject = reject;
        });
        this._runP = p;
        if (!this._sliced) {
            try {
                this.status = UploadStatus.WAITING;
                await this.startSlice();
                this._sliced = true;
                this.setStatus(
                    this._canceled,
                    UploadStatus.PENDING,
                    UploadStatus.READY,
                );
            } catch (error) {
                const theError = transformError(error);
                if (this._canceled || isCancel(theError)) {
                    this._canceled = true;
                    this.running = false;
                    this.status = UploadStatus.CANCEL;
                    asyncApply(
                        this.uploadQueue.options.onCancel,
                        [
                            "分片时取消上传",
                            this.file,
                            this.files,
                        ],
                    );
                    this._runResolve();
                } else {
                    //切片错误执行回调
                    asyncApply(
                        this.uploadQueue.options
                            .onSliceError,
                        [theError, this.file, this.files],
                        this.running,
                    );
                    debugWarn(theError);
                    this._runReject?.(theError);
                    this.running = false;
                    this.status = UploadStatus.FAILED;
                }
                return this._runP;
            }
        }
        if (this.running) {
            if (this.status === UploadStatus.PENDING) {
                this.status = UploadStatus.READY;
            }
            try {
                await this.startUpload();
                this.status = UploadStatus.SUCCESS;
                this.isFinished = true;
                this.file.uploaded = this.file.size;
                this.file.percentage = 1;
                syncApply(
                    this.uploadQueue.options.onSuccess,
                    [this.file],
                    this.running,
                );
                this.running = false;
                this._runResolve?.(true);
            } catch (error) {
                if (this._canceled || isCancel(error)) {
                    this._canceled = true;
                    this.running = false;
                    this.status = UploadStatus.PENDING;
                    const theError = isCancel(error)
                        ? error
                        : getError("未知错误", true);
                    asyncApply(
                        this.uploadQueue.options.onCancel,
                        [
                            theError.message,
                            this.file,
                            this.files,
                        ],
                    );
                } else {
                    this.status = UploadStatus.FAILED;
                    this.running = false;
                    debugWarn(error as BigFileError);
                    syncApply(
                        this.uploadQueue.options
                            .onUploadError,
                        [
                            error as BigFileError,
                            this.file,
                            this.files,
                        ],
                        this.running,
                    );
                }
                /* empty */
                this._runReject?.(error);
            }
        } else {
            //任务停止
            this.running = false;
            this._runResolve?.(false);
        }
        return this._runP;
    }

    /**
     * 暂停任务()
     * @param message
     */
    stop(message: string) {
        this.running = false;
        this._canceled = true;
        this.cancelSlice();
        this.cancelUpload(message);
    }

    /**
     * 销毁移除任务
     */
    destroy() {
        this.stop("销毁");
        this.uploadQueue.remove(this.file);
    }

    set running(val) {
        this._running = val;
    }
    get running() {
        return this._running;
    }

    get chunks() {
        return this.file.chunks!;
    }
    set chunks(val) {
        this.file.chunks = val;
    }

    get options() {
        return this._options;
    }

    get request() {
        return this.uploadQueue.request;
    }
    get actions() {
        return this.uploadQueue.options.actions;
    }

    get status() {
        return this.file.status;
    }

    private get files() {
        return this.uploadQueue.fileQueue;
    }
    /**
     * 改变当前上传任务状态
     * @param status
     */
    set status(status) {
        if (this.status === status) {
            return;
        }
        switch (this.status) {
            //都上传成功了，不需要再次变更
            case UploadStatus.SUCCESS:
                return;
        }
        syncApply(this.uploadQueue.options.onStatusChange, [
            status,
            this.status,
            this.file,
        ]);
        this.file.status = status;
        // eslint-disable-next-line no-empty
        switch (
            status
            //TODO:干点别的什么
        ) {
        }
    }
    get uploadedChunks() {
        return this._uploadedChunks;
    }

    set uploadedChunks(list) {
        this._uploadedChunks = list;
        this.uploadedSize = list.reduce(
            (acc, current) => acc + current.size,
            0,
        );
    }

    set uploadTime(time: number) {
        this._uploadTime = time;
    }
    get uploadTime() {
        return this._uploadTime || 0;
    }
    get uploadedSize() {
        const val = this._uploadedChunks.reduce(
            (acc, current) => acc + current.size,
            0,
        );
        this.file.uploaded = val;
        return val;
    }
    set uploadedSize(val) {
        this.file.uploaded = val;
    }

    private setStatus(
        condition: boolean,
        trueVal: UploadStatus,
        falseVal: UploadStatus,
    ) {
        this.status = condition ? trueVal : falseVal;
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
        this.status = UploadStatus.UPLOADING;
        let currentIndex = 0;
        const tasks: UploadApiReturn[] = [];
        const startTime = performance.now();
        const startSize = this.uploadedSize;
        while (currentIndex < chunks.length) {
            const chunk = chunks[currentIndex];
            const task = this.uploadChunkApi(
                chunk,
                this.file,
            );
            const p = task.then((resp) => {
                if (resp.success) {
                    this.uploadedChunks.push(chunk);
                    this.updateFileProgress(
                        this.uploadedSize - startSize,
                        performance.now() - startTime,
                    );
                }
                if (this._canceled) {
                    throw getError("用户取消上传", true);
                }
                if (resp.error || resp.isCancel) {
                    throw resp.error;
                }
                return resp;
            });
            tasks.push(p);
            currentIndex++;
        }
        return Promise.all(tasks);
    }
    updateFileProgress(
        rangeSize: number,
        rangeTime: number,
    ) {
        //上传总大小
        const count = Math.min(
            this.file.size,
            this.uploadedSize,
        );
        //剩余上传大小
        const left = this.file.size - count;
        //计算出的速率是 x byte/s
        const rate = rangeSize
            ? Math.round(rangeSize / rangeTime) * 1000
            : 0;
        //处理成可读的模式
        const rateText = humanFormat.bytes(rate);
        this.rate = rateText;
        const leftTime =
            rate && left
                ? parseFloat((left / rate).toFixed(2))
                : 0;
        this.leftTime = leftTime;
        //百分比计算
        const percentage =
            Math.round((count / this.file.size) * 100) /
            100;
        this.file.percentage = percentage;
        const event: UploadProgressEvent = {
            rate,
            rateText,
            uploaded: count,
            size: this.file.size,
            leftTime: leftTime,
            percentage,
            file: this.file,
            raw: this.file.raw,
        };
        asyncApply(this.uploadQueue.options.onProgress, [
            percentage,
            this.file,
            event,
        ]);
    }
}
