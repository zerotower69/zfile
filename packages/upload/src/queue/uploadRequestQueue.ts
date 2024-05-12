import axios, {
    AxiosResponse,
    CancelTokenSource,
} from "axios";
import { UploadTask } from "./uploadTask";
import { isFunction } from "lodash-es";
import { RequestLimit } from "../interface";

export interface UploadRequestQueueOptions {
    /**
     * 任务并发数
     */
    parallel?: 1 | 2 | 3;
    /**
     * 请求并发数
     */
    requestLimit: RequestLimit;
    /**
     * 最大重试次数
     */
    maxRetries?: number;
}

export type RequestTask<D = any> = (() => Promise<
    AxiosResponse<D>
>) & {
    _source?: CancelTokenSource;
    _isOpenRetry?: boolean;
    _retries?: number;
    _url?: string;
};

interface TaskContext<T = any> {
    p: Promise<AxiosResponse<T>>;
    upload: UploadTask;
    //请求任务
    task: RequestTask<T>;
    //resolve钩子
    resolve: (value: T | PromiseLike<T>) => void;
    //reject钩子
    reject: (reason?: any) => void;
    //重试次数统计
    retries?: number;
}

//请求任务返回
export interface TaskReturn<T> {
    //请求是否响应成功
    success: boolean;
    //描述信息
    message: string;
    //是否被取消
    isCancel: boolean;
    //响应体
    response?: AxiosResponse<T>;
    //错误
    error?: any;
}

export class UploadRequestQueue {
    queue: WeakMap<UploadTask, TaskContext[]>;
    uploadTasks: UploadTask[];
    tokenSource: WeakMap<TaskContext, CancelTokenSource>;
    errorMap: Map<string, number>;
    private _current: number;
    private timer?: number;
    private isThrottle: boolean;
    private running = true;
    private _runningCount: number;
    private readonly parallel: number;
    private readonly requestLimit: number;
    private readonly maxRetries: number;
    constructor(options: UploadRequestQueueOptions) {
        const {
            parallel = 2,
            requestLimit = 6,
            maxRetries = 3,
        } = options;
        this.queue = new WeakMap();
        this.tokenSource = new WeakMap();
        this.uploadTasks = [];
        this._current = 0;
        this.running = false;
        this._runningCount = 0;
        this.parallel = parallel;
        this.requestLimit = Math.min(6, requestLimit);
        this.isThrottle = false;
        this.maxRetries = maxRetries;
        this.errorMap = new Map();
    }

    /**
     * 添加上传任务
     * @param task 上传任务
     * @private
     */
    private addUploadTask(task: UploadTask) {
        const found = this.uploadTasks.find(
            (item) => item.id === task.id,
        );
        if (!found) {
            this.uploadTasks.push(task);
        }
    }

    /**
     * 添加请求任务
     * @param uploadTask
     * @param task
     */
    add<T = any>(
        uploadTask: UploadTask,
        task: RequestTask<T> | TaskContext<T>,
    ) {
        this.addUploadTask(uploadTask);
        this.running = true;
        let tasks: TaskContext[] =
            this.queue.get(uploadTask)!;
        if (!tasks) {
            this.queue.set(uploadTask, (tasks = []));
        }
        if (!isFunction(task)) {
            //由重试添加的，用unshift实现插队，让重试的请求先被发起
            tasks.unshift(task);
            return task.p;
        }
        //新增的
        const context: Partial<TaskContext> = {};
        context.upload = uploadTask;
        context.retries = 0;
        context.task = task;

        const p = new Promise<AxiosResponse<T>>(
            (resolve, reject) => {
                context.resolve = resolve;
                context.reject = reject;
            },
        );
        context.p = p;
        tasks.push(context as TaskContext);
        setTimeout(() => {
            this.run();
        }, 0);
        return p;
    }

    /**
     * 取消上传任务对应的所有请求
     * @param upload 上传任务
     * @param message 取消信息
     */
    cancelUpload(upload: UploadTask, message = "手动取消") {
        const contexts = this.queue.get(upload);
        if (contexts && contexts.length) {
            while (contexts.length) {
                const context = contexts.shift()!;
                const source = context.task._source;
                if (source) {
                    source.cancel(message);
                }
            }
        }
    }

    /**
     * 移除上传任务
     * @param upload
     */
    remove(upload: UploadTask) {
        const index = this.uploadTasks.findIndex(
            (item) => item.id === upload.id,
        );
        if (index > -1) {
            this.uploadTasks.splice(index, 1);
        }
    }

    private run() {
        //并发控制，需要同时满足以下条件：
        // 1.任务队列有任务，
        // 2.并发没达到最大限制
        // 3.任务队列处于运行状态，
        // 4.节流开关已关闭
        while (
            this.uploadTasks.length &&
            this.runningCount < this.requestLimit &&
            this.running &&
            !this.isThrottle
        ) {
            //交替发起多个上传任务的请求
            let uploadTask = this.uploadTasks[this.current];
            this.current++;
            let tasks = this.queue.get(uploadTask)!;
            //对应的某个文件上传任务(FileTask)，其请求队列为空，就将该任务从队列中移除
            if (!(tasks?.length ?? 0)) {
                this.remove(uploadTask);
                if (!this.uploadTasks.length) break;
            }
            //没从当前fileTask找到需要发送的请求，继续向后找
            while (this.current < this.uploadTasks.length) {
                if (!tasks || !tasks.length) {
                    uploadTask =
                        this.uploadTasks[this.current];
                    this.current++;
                    tasks = this.queue.get(uploadTask)!;
                } else {
                    break;
                }
            }
            if (tasks.length) {
                //找到请求队列，且请求队列不为空
                const context = tasks.shift()!;
                this.dealTask(context);
            } else {
                //没有需要请求的了，退出循环
                break;
            }
        }
    }

    private dealTask(context: TaskContext) {
        const { task, upload, resolve, reject, retries } =
            context;
        this.runningCount++;
        const source = task._source!;
        this.tokenSource.set(context, source);
        const count = this.errorMap.get(task._url) || 0;
        if (count >= 6) {
            reject(
                new axios.CanceledError(
                    "接口请求失败次数过多，停止访问",
                ),
            );
            this.runningCount--;
            this.run();
            return;
        }
        //运行task,拿到promise
        const promise = Promise.resolve(task());
        //响应成功，直接返回
        promise.then((value) => {
            if (this.errorMap.has(task._url)) {
                this.errorMap.set(task._url, 0);
            }
            this.tokenSource.delete(context);
            resolve(value);
        });
        //响应失败
        promise
            .catch((reason) => {
                //如果是被手动取消的
                if (axios.isCancel(reason)) {
                    this.tokenSource.delete(context);
                    reject(reason);
                    return;
                }
                if (!this.errorMap.has(task._url)) {
                    this.errorMap.set(task._url, 0);
                }
                const count = this.errorMap.get(task._url);
                this.errorMap.set(task._url, count + 1);
                const isOpenRetry =
                    task?._isOpenRetry ?? true;
                const maxRetries =
                    task?._retries ?? this.maxRetries;
                //TODO:进一步统计错误信息
                if (
                    !isOpenRetry ||
                    retries! >= maxRetries
                ) {
                    this.tokenSource.delete(context);
                    reject(reason);
                    return;
                }
                //请求重试
                context.retries = (retries || 0) + 1;
                this.add(upload, context);
            })
            .finally(() => {
                this.runningCount--;
                this.run();
            });
    }

    set current(val: number) {
        if (!this.uploadTasks.length) {
            this._current = -1;
            return;
        }
        //可能并发数上传文件允许为3，但是此刻只有一个文件需要上传
        this._current =
            val %
            Math.min(
                this.parallel,
                this.uploadTasks.length,
            );
    }
    get current() {
        return this._current;
    }

    get runningCount() {
        return this._runningCount;
    }

    //通过set属性写入器，可以在runningCount设置值的同时就
    //处理节流相关逻辑
    set runningCount(val) {
        this._runningCount = val;
        //如果达到了最大请求并发数，那么就先打开节流开关
        // 设置一个定时器，定制器自动地
        if (val >= this.requestLimit) {
            this.isThrottle = true;
            //@ts-ignore
            this.timer = setTimeout(() => {
                this.isThrottle = false;
                this.run();
                this.timer = void 0;
            }, 200);
        }
    }

    //停止
    stop(clear = false) {
        this.running = false;
        this.runningCount = 0;
        if (this.timer) {
            clearTimeout(this.timer);
        }
        if (clear) {
            this.uploadTasks.length = 0;
            this.tokenSource = new WeakMap();
            this.queue = new WeakMap();
        }
    }
    //开始
    start() {
        if (!this.running) {
            this.running = true;
            this.runningCount = 0;
            this.run();
        }
    }
}
