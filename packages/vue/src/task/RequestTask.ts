import { FileTask } from "./FileTask";
import { AxiosResponse } from "axios";

interface RequestTaskOptions {
    parallel?: 1 | 2 | 3;
    maxRequestCount?: number;
}

type Task<D = any> = () => Promise<AxiosResponse<D>>;
interface TaskContext<T = any> {
    task: Task<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

export class RequestTask {
    task: WeakMap<FileTask, TaskContext[]>;
    queue: FileTask[];
    private _current: number;
    private timer?: number;
    private isThrottle: boolean;
    private running = true;
    private _runningCount: number;
    private parallel: number;
    private requestLimit: number;
    constructor(options: RequestTaskOptions) {
        const { parallel = 2, maxRequestCount = 6 } = options;
        this.task = new WeakMap();
        this.queue = [];
        this._current = 0;
        this.running = false;
        this._runningCount = 0;
        this.parallel = parallel;
        this.requestLimit = Math.min(6, maxRequestCount);
        this.isThrottle = false;
    }

    //添加上传任务
    private addQueue(task: FileTask) {
        const found = this.queue.find((item) => item.id === task.id);
        if (!found) {
            this.queue.push(task);
        }
    }
    //添加请求任务
    add<T = any>(fileTask: FileTask, task: Task<T>) {
        this.addQueue(fileTask);
        this.running = true;
        return new Promise<T>((resolve, reject) => {
            const context: TaskContext = {
                task,
                resolve,
                reject,
            };
            let tasks: TaskContext[] = this.task.get(fileTask)!;
            if (!tasks) {
                this.task.set(fileTask, (tasks = []));
            }
            tasks.push(context);
            this.run();
        });
    }
    remove(task: FileTask) {
        const index = this.queue.findIndex((item) => item.id === task.id);
        if (index > -1) {
            this.queue.splice(index, 1);
        }
    }
    private run() {
        //并发控制，需要同时满足以下条件：
        // 1.任务队列有任务，
        // 2.并发没达到最大限制
        // 3.任务队列处于运行状态，
        // 4.节流开关已关闭
        while (this.queue.length && this.runningCount < this.requestLimit && this.running && !this.isThrottle) {
            //交替上传多个文件
            let fileTask = this.queue[this.current];
            this.current++;
            let tasks = this.task.get(fileTask)!;
            //对应的某个文件上传任务(FileTask)，其请求队列为空，就将该任务从队列中移除
            if (!tasks.length) {
                this.remove(fileTask);
                if (!this.queue.length) break;
            }
            //没从当前fileTask找到需要发送的请求，继续向后找
            while (this.current < this.queue.length) {
                if (!tasks || !tasks.length) {
                    fileTask = this.queue[this.current];
                    this.current++;
                    tasks = this.task.get(fileTask)!;
                } else {
                    break;
                }
            }
            if (tasks.length) {
                //找到请求队列，且请求队列不为空
                const context = tasks.shift()!;
                const { task, resolve, reject } = context;
                this.runningCount++;
                Promise.resolve(task())
                    .then(resolve, reject)
                    .finally(() => {
                        this.runningCount--;
                        this.run();
                    });
            } else {
                //没有需要请求的了，退出循环
                break;
            }
        }
    }
    set current(val: number) {
        if (!this.queue.length) {
            this._current = -1;
            return;
        }
        //可能并发数上传文件允许为3，但是此刻只有一个文件需要上传
        this._current = val % Math.min(this.parallel, this.queue.length);
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
            this.queue.length = 0;
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
