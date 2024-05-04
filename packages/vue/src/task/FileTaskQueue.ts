import { FileTask } from "./FileTask.ts";
import { FileStatus, UploadFile } from "../interface.ts";
import { FileQueue } from "./FileQueue.ts";
import { SuperTask } from "./superTask.ts";
import { RequestTask } from "./RequestTask.ts";

export interface FileTaskListOption {
    fileQueue: FileQueue;
    sliceParallel?: 1 | 2 | 3;
    uploadParallel?: number;
}

/**
 * 多个文件的任务调度，只用需要处理的任务才放入此队列
 */
export class FileTaskQueue {
    tasks: FileTask[];
    options: FileTaskListOption;
    _running: boolean;
    _timer?: number | null;
    requestQueue: RequestTask;
    fileQueue: FileQueue;
    sliceQueue: SuperTask;
    uploadQueue: SuperTask;
    constructor(options: FileTaskListOption) {
        const { sliceParallel = 2, uploadParallel = 2 } = options;
        const maxSliceParallel = Math.min(sliceParallel, 3);
        const maxUploadParallel = Math.min(uploadParallel, 6);
        this.options = options;
        this.tasks = [];
        this._running = false;
        this.requestQueue = new RequestTask({});
        this.fileQueue = options.fileQueue;
        this.sliceQueue = new SuperTask(maxSliceParallel);
        this.uploadQueue = new SuperTask(maxUploadParallel);
    }

    /**
     * 增加任务
     * @param file
     */
    add(file: UploadFile) {
        const found = this.tasks.find((task) => task.file.uid === file.uid);
        if (found) {
            return;
        }
        const task = new FileTask({
            file,
            taskQueue: this,
            fileQueue: this.fileQueue,
            actions: this.actions,
            requestConfig: {
                withCredentials: this.withCredentials,
                headers: this.headers,
            },
        });
        this.tasks.push(task);
        task.start();
    }

    /**
     * 移除任务
     * @param task
     */
    remove(task: FileTask) {
        const index = this.tasks.findIndex((item) => item.id === task.id);
        if (index > -1) {
            this.tasks.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 启动多文件上传任务队列，如果已经启动则忽略
     */
    start() {
        if (!this._running) {
            //@ts-ignore
            this._timer = setInterval(() => {
                const files = this.fileQueue.queue.filter((file) => {
                    return ![FileStatus.PENDING, FileStatus.SUCCESS, FileStatus.FAIL, FileStatus.UPLOADING].includes(file.status);
                });
                if (!files.length) {
                    stop();
                } else {
                    files.forEach((file) => {
                        this.add(file);
                    });
                }
            }, 2000);
        }
    }

    get actions() {
        return this.fileQueue.options.actions;
    }
    get withCredentials() {
        return this.fileQueue.options.withCredentials;
    }
    get headers() {
        return this.fileQueue.options.headers;
    }

    /**
     * 终止执行
     */
    stop(status = FileStatus.PENDING) {
        if (this._running) {
            this.tasks.forEach((task) => {
                task.stop(status);
            });
            clearInterval(this._timer as number);
            this._timer = null;
            this._running = false;
            this.requestQueue.stop();
        }
    }
}
