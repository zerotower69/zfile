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
    BigFileError,
    getError,
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
    id: number;
    uploadQueue: UploadQueue;
    file: UploadFile;
    _status: UploadStatus;
    private sliceContext: UseSliceFileReturn;
    private _options: UploadTaskOptions;
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
        this.status = status;
        this.sliceContext = useSliceFile(
            file,
            this.options?.worker?.thread ?? 4,
            this.options?.worker?.timeout,
            this.options?.worker?.spark_md5_url,
        );
        this._running = false;
        this.uploadedSize = 0;
        this._uploadedChunks = [];
        this._sliced = false;
        this._canceled = false;
        this.isFinished = false;
    }

    async start() {
        if (this.running) {
            return false;
        }
        this._canceled = false;
        this.running = true;
        const p = new Promise<void>((resolve, reject) => {
            this._runResolve = resolve;
            this._runReject = reject;
        });
        this._runP = p;
        try {
            await this.startSlice();
        } catch (error) {
            this._runReject?.(error);
            this.status = UploadStatus.FAILED;
            return this._runP;
        }
        this.status = UploadStatus.READY;
        if (this.running) {
            try {
                await this.startUpload();
                this.status = UploadStatus.SUCCESS;
                this.isFinished = true;
                this.uploadQueue.options?.onSuccess(
                    this.file,
                );
                this.file.uploaded = this.file.size;
                this.file.percentage = 1;
                this.running = false;
                this._runResolve?.(true);
            } catch (error) {
                /* empty */
                this._runReject?.(error);
            }
        } else {
            //任务停止
            this._runResolve?.(false);
        }
        return this._runP;
    }

    /**
     * 开始切片
     */
    private startSlice() {
        return this.uploadQueue.sliceQueue.add(async () => {
            if (!this._sliced) {
                this.status = UploadStatus.READING;
                this.uploadQueue.options?.onSliceStart?.(
                    this.file,
                    this.files,
                );
                // eslint-disable-next-line no-useless-catch
                try {
                    const data =
                        await this.sliceContext.start();
                    this.file.hash = data.fileHash;
                    this.file.chunks = data.fileChunks;
                    this._sliced = true;
                    this.uploadQueue.options?.onSliceEnd?.(
                        this.file,
                        this.files,
                    );
                    return {
                        skip: false,
                        data: data,
                    };
                } catch (error) {
                    this.status = UploadStatus.FAILED;
                    this.running = false;
                    const newError = transformError(error);
                    this.uploadQueue.options?.onSliceError?.(
                        newError,
                        this.file,
                        this.files,
                    );
                    throw newError;
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
    cancelSlice() {
        this.sliceContext.stop();
    }
    private startUpload() {
        return this.uploadQueue.uploadingQueue.add(
            async () => {
                this.uploadQueue.options?.onUploadStart?.(
                    this.file,
                    this.files,
                );
                if (this.status === UploadStatus.WAITING) {
                    this.running = false;
                    const error = getError("文件未切片");
                    this.uploadQueue.options?.onUploadError?.(
                        error,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                //检查文件上传完成没有
                const check = await this.checkChunkApi(
                    this.file,
                    this.chunks,
                );
                if (check.success) {
                    this.status = UploadStatus.MERGING;
                    //还得调用一次merge
                    const merge = await this.mergeChunkApi(
                        this.file,
                        this.chunks,
                    );
                    if (merge.isCancel) {
                        this._canceled = true;
                        this.status = UploadStatus.CANCEL;
                        const error = getError(
                            "取消操作",
                            true,
                        );
                        this.uploadQueue.options?.onUploadError?.(
                            error,
                            this.file,
                            this.files,
                        );
                        throw error;
                    }
                    if (!merge.success) {
                        const error = transformError(
                            merge.error,
                        );
                        this.uploadQueue.options?.onUploadError?.(
                            error,
                            this.file,
                            this.files,
                        );
                        throw error;
                    }
                    this.uploadedSize = this.file.size;
                    this.status = UploadStatus.SUCCESS;
                    return;
                } else if (check.isCancel) {
                    //取消上传
                    this.running = false;
                    this._canceled = true;
                    this.status = UploadStatus.CANCEL;
                    const error = getError(
                        "check上传取消",
                        true,
                    );
                    this.uploadQueue.options?.onUploadError?.(
                        error,
                        this.file,
                        this.files,
                    );
                    throw error;
                } else if (check.error) {
                    //未知错误
                    this.running = false;
                    this.status = UploadStatus.FAILED;
                    const error = transformError(
                        check.error,
                    );
                    this.uploadQueue.options?.onUploadError?.(
                        error,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                const waitingChunks = check.chunks!;
                if (check.uploadedChunks) {
                    this.uploadedChunks =
                        check.uploadedChunks;
                }
                this._uploadTime = performance.now();
                try {
                    await this.uploadChunks(waitingChunks);
                } catch (error) {
                    this.running = false;
                    this.status = UploadStatus.FAILED;
                    setTimeout(() => {
                        this.uploadQueue.options?.onUploadError?.(
                            error as BigFileError,
                            this.file,
                            this.files,
                        );
                    }, 0);
                    throw error;
                }
                const checkAgain = await this.checkChunkApi(
                    this.file,
                    this.chunks,
                );
                if (checkAgain.isCancel) {
                    //取消上传
                    this._canceled = true;
                    this.status = UploadStatus.CANCEL;
                    const error = getError(
                        "上传取消",
                        true,
                    );
                    this.uploadQueue.options?.onUploadError?.(
                        error as BigFileError,
                        this.file,
                        this.files,
                    );
                    throw error;
                } else if (checkAgain.error) {
                    //检查接口错误
                    this.status = UploadStatus.FAILED;
                    this.running = false;
                    const error =
                        getError("检查分片接口错误");
                    this.uploadQueue.options?.onUploadError?.(
                        error as BigFileError,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                if (
                    !checkAgain.success ||
                    checkAgain.chunks!.length !== 0
                ) {
                    //未知错误
                    this.status = UploadStatus.FAILED;
                    this.running = false;
                    const error = getError("发生错误");
                    this.uploadQueue.options?.onUploadError?.(
                        error as BigFileError,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                this.status = UploadStatus.MERGING;
                //开始合并
                const mergeChunks =
                    await this.mergeChunkApi(
                        this.file,
                        this.chunks,
                    );
                if (mergeChunks.isCancel) {
                    //取消上传
                    this.status = UploadStatus.CANCEL;
                    this.running = false;
                    const error = getError(
                        "上传取消",
                        true,
                    );
                    this.uploadQueue.options?.onUploadError?.(
                        error as BigFileError,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                if (mergeChunks.error) {
                    //合并接口错误
                    this.status = UploadStatus.FAILED;
                    this.running = false;
                    const error = transformError(
                        mergeChunks.error,
                    );
                    this.uploadQueue.options?.onUploadError?.(
                        error as BigFileError,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                if (!mergeChunks.success) {
                    //未知错误
                    this.status = UploadStatus.FAILED;
                    this.running = false;
                    const error = getError("发生错误");
                    this.uploadQueue.options?.onUploadError?.(
                        error as BigFileError,
                        this.file,
                        this.files,
                    );
                    throw error;
                }
                this.status = UploadStatus.SUCCESS;
            },
        );
    }

    /**
     * 取消上传
     */
    cancelUpload(message = "手动取消") {
        this.uploadQueue.requestQueue.cancelUpload(
            this,
            message,
        );
    }

    /**
     * 取消任务
     * @param message
     */
    stop(message: string) {
        this.cancelSlice();
        this.cancelUpload(message);
        this.running = false;
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
        this.options?.onChangeStatus?.(
            this.file,
            status,
            this.status,
        );
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
        this.uploadTime = performance.now();
        while (currentIndex < chunks.length) {
            const chunk = chunks[currentIndex];
            const task = this.uploadChunkApi(
                chunk,
                this.file,
            );
            task.then((resp) => {
                if (resp.success) {
                    this.uploadedChunks.push(chunk);
                    this.updateFileProgress(chunk);
                }
                if (resp.error) {
                    throw resp.error;
                }
                return resp;
            });
            tasks.push(task);
            currentIndex++;
        }
        return Promise.all(tasks);
    }
    updateFileProgress(chunk?: UploadChunk) {
        //上传总大小
        const count = Math.min(
            this.file.size,
            this.uploadedSize,
        );
        //剩余上传大小
        const left = this.file.size - count;
        const time = performance.now();
        //时间刻度
        const rangeTime = time - this.uploadTime;
        //由于每次调用在chunk上传成功后，因此这段时间的上传大小就是上传的这个chunk的大小
        const rangeSize = chunk.size;
        this.uploadedSize = count;
        //计算出的速率是 x byte/s
        const rate = rangeSize
            ? Math.round((1000 * rangeSize) / rangeTime)
            : 0;
        //处理成可读的模式
        const rateText = humanFormat.bytes(rate);
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
            leftTime: rate && left ? left / rate : 0,
            percentage,
            file: this.file,
            raw: this.file.raw,
        };
        this.uploadQueue.options?.onProgress?.(
            percentage,
            this.file,
            event,
        );
    }
}
