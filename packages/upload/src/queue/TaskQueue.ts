type taskFn<T = any> = (...args: any[]) => T;
interface TaskContext<T = any> {
    task: taskFn;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

/**
 * 异步任务队列控制并发
 */
export class TaskQueue {
    private queue: TaskContext[];
    private parallelCount: number;
    private runningCount: number;
    private isCancel: boolean;
    constructor(parallel: number) {
        this.queue = [];
        this.parallelCount = parallel;
        this.runningCount = 0;
        this.isCancel = false;
    }

    /**
     * 添加并发任务
     * @param task
     */
    add<T>(task: taskFn<T>) {
        this.isCancel = false;
        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                task,
                resolve,
                reject,
            });
            this._run();
        });
    }

    /**
     * 取消并发控制
     */
    cancel() {
        this.isCancel = true;
    }

    private _run() {
        while (
            this.runningCount <= this.parallelCount &&
            this.queue.length &&
            !this.isCancel
        ) {
            const { task, resolve, reject } =
                this.queue.shift() as TaskContext;
            this.runningCount++;
            Promise.resolve<any>(task())
                .then(resolve, reject)
                .finally(() => {
                    this.runningCount--;
                    this._run();
                });
        }
    }
}
