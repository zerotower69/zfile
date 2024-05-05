import { debounce } from "lodash-es";
import humanFormat from "human-format";
import dayjs from "dayjs";
import {
    ProgressContext,
    UploadChunk,
    UploadFile,
    UploadStatus,
    WorkerConfig,
} from "../interface";
import { UploadQueue } from "./uploadQueue.ts";
import {
    getCheckChunkApi,
    getMergeChunkApi,
    getUploadChunkApi,
} from "../api.ts";
import {
    useSliceFile,
    UseSliceFileReturn,
} from "../slice.ts";
import { getError, transformError } from "../utils";

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
    private _uploadedSize: number;
    private updateFileProgress: (
        task: UploadTask,
        chunk: UploadChunk,
    ) => void;
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
        this._status = status;
        this.sliceContext = useSliceFile(
            file,
            this.options?.worker?.thread ?? 4,
            this.options?.worker?.timeout,
            this.options?.worker?.spark_md5_url,
        );
        this._running = false;
        this._uploadedSize = 0;
        this._uploadedChunks = [];
        this.updateFileProgress = debounce(
            updateFileProgress,
            100,
        );
    }

    async start() {
        if (this.running) {
            return false;
        }
        this.running = true;
        //TODO:有重试的必要吗
        const p = new Promise<void>((resolve, reject) => {
            this._runResolve = resolve;
            this._runReject = reject;
        });
        this._runP = p;
        try {
            await this.startSlice();
        } catch (e) {
            this._runReject?.(transformError);
        }
        this.status = UploadStatus.READY;
        if (this.running) {
            try {
                await this.startUpload();
            } catch (e) {
                /* empty */
            }
        } else {
            //任务停止
            this._runReject?.("任务停止");
        }
        return p;
    }

    /**
     * 开始切片
     */
    startSlice() {
        return this.uploadQueue.sliceQueue.add(async () => {
            if (this.status === UploadStatus.WAITING) {
                this.status = UploadStatus.READING;
                try {
                    const data =
                        await this.sliceContext.start();
                    this.status = UploadStatus.READY;
                    this.file.hash = data.fileHash;
                    this.chunks = data.fileChunks;
                    console.log(
                        "切片成功",
                        this,
                        this.file,
                    );
                    return true;
                } catch (error) {
                    this.status = UploadStatus.FAILED;
                    throw error;
                }
            } else {
                return true;
            }
        });
    }

    /**
     * 取消切片
     */
    cancelSlice() {
        this.sliceContext.stop();
    }
    startUpload() {
        return this.uploadQueue.uploadingQueue.add(
            async () => {
                if (this.status === UploadStatus.WAITING) {
                    this._runReject?.(
                        getError("文件未切片"),
                    );
                    return this._runP;
                }
                this._uploadTime = Date.now();
                //检查文件上传完成没有
                const check = await this.checkChunkApi(
                    this.file,
                    this.chunks,
                );
                if (check.success) {
                    //文件秒传
                    this.uploadedSize = this.file.size;
                    this.status = UploadStatus.SUCCESS;
                    this._runResolve?.(check.response);
                    return this._runP;
                } else if (check.error) {
                    //发生错误
                    if (check.isCancel) {
                        //取消上传
                        this.status = UploadStatus.CANCEL;
                        this._runReject?.(
                            getError("上传取消"),
                        );
                        return this._runP;
                    }
                    //未知错误
                    this.status = UploadStatus.FAILED;
                    this._runReject?.(
                        transformError(check.error),
                    );
                    return this._runP;
                }
                const waitingChunks = check.chunks!;
                if (check.uploadedChunks) {
                    this.uploadedChunks =
                        check.uploadedChunks;
                }
                const uploads =
                    await this.uploadChunks(waitingChunks);
                const hasCancel = uploads.some(
                    (upload) => upload.isCancel,
                );
                if (hasCancel) {
                    //取消上传
                    this.status = UploadStatus.CANCEL;
                    this._runReject?.(getError("上传取消"));
                    return this._runP;
                }
                //TODO:一定要确定全部完成？
                const allSuccess = uploads.every(
                    (upload) => upload.success,
                );
                if (!allSuccess) {
                    //上传分片发生错误
                    this.status = UploadStatus.FAILED;
                    this._runReject?.(getError("上传取消"));
                    return this._runP;
                }
                const checkAgain = await this.checkChunkApi(
                    this.file,
                    this.chunks,
                );
                if (checkAgain.isCancel) {
                    //取消上传
                    this.status = UploadStatus.CANCEL;
                    this._runReject?.(getError("上传取消"));
                    return this._runP;
                }
                if (checkAgain.error) {
                    //检查接口错误
                    this.status = UploadStatus.FAILED;
                    this._runReject?.(
                        getError("检查分片接口错误"),
                    );
                    return this._runP;
                }
                if (
                    !checkAgain.success ||
                    checkAgain.chunks!.length !== 0
                ) {
                    //未知错误
                    this.status = UploadStatus.FAILED;
                    this._runReject?.(getError("发生错误"));
                    return this._runP;
                }
                // this.uploadedSize = (checkAgain?.uploadedChunks ?? []).reduce((acc, cur) => acc + cur.size, 0);
                //开始合并
                const mergeChunks =
                    await this.mergeChunkApi(
                        this.file,
                        this.chunks,
                    );
                if (mergeChunks.isCancel) {
                    //取消上传
                    this.status = UploadStatus.CANCEL;
                    this._runReject?.(getError("上传取消"));
                    return this._runP;
                }
                if (mergeChunks.error) {
                    //合并接口错误
                    this.status = UploadStatus.FAILED;
                    this._runReject?.(
                        getError("检查分片接口错误"),
                    );
                    return this._runP;
                }
                if (!mergeChunks.success) {
                    //未知错误
                    this.status = UploadStatus.FAILED;
                    this._runReject?.(getError("发生错误"));
                    return this._runP;
                }
                this.status = UploadStatus.SUCCESS;
                this._runResolve?.(mergeChunks.response);
                return this._runP;
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
        return this._status;
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
        this._status = status;
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
        this._uploadedSize = list.reduce(
            (acc, current) => acc + current.size,
            0,
        );
        console.log(
            this._uploadedChunks,
            this._uploadedSize,
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
        this._uploadedSize = val;
        return val;
    }
    set uploadedSize(val) {
        this._uploadedSize = val;
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
        const tasks = [];
        this.uploadTime = Date.now();
        while (currentIndex < chunks.length) {
            const chunk = chunks[currentIndex];
            const task = this.uploadChunkApi(
                chunk,
                this.file,
            );
            task.then((resp) => {
                if (resp.success) {
                    this.uploadedChunks.push(chunk);
                    this.updateFileProgress(this, chunk);
                }
                return resp;
            });
            tasks.push(task);
            currentIndex++;
        }
        return Promise.all(tasks);
    }
}

function updateFileProgress(
    task: UploadTask,
    chunk: UploadChunk,
) {
    //上传总大小
    const count = Math.min(
        task.file.size,
        task.uploadedSize,
    );
    //剩余上传
    const left = task.file.size - count;
    const time = Date.now();
    //时间刻度
    const rangeTime = dayjs(time).diff(task.uploadTime);
    const rangeSize = chunk.size;
    task.uploadedSize = count;
    const rate = rangeSize
        ? Math.round((1000 * rangeSize) / rangeTime)
        : 0;
    const rateText = humanFormat.bytes(rate);
    task.uploadTime = time;
    const percentage =
        Math.round((count / task.file.size) * 100) / 100;
    task.file.percentage = percentage;
    const context: ProgressContext = {
        rate,
        rateText,
        uploaded: count,
        size: task.file.size,
        leftTime: rate && left ? left / rate : 0,
        percentage,
        file: task.file,
        raw: task.file.raw,
    };
    task.uploadQueue.options?.onProgress?.(
        percentage,
        task.file,
        context,
    );
}
