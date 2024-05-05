import createWorkerBlobUrl from "./lib/createWorkerBlobUrl";
import { isClient } from "./lib/is";

export interface ConfigurableWindow {
    /*
     * Specify a custom `window` instance, e.g. working with iframes or in testing environments.
     */
    window?: Window;
}

const defaultWindow = /* #__PURE__ */ isClient
    ? window
    : undefined;

export type WebWorkerStatus =
    | "PENDING"
    | "SUCCESS"
    | "RUNNING"
    | "ERROR"
    | "TIMEOUT_EXPIRED";

export interface UseWebWorkerOptions
    extends ConfigurableWindow {
    /**
     * Number of milliseconds before killing the worker
     *
     * @default undefined
     */
    timeout?: number;
    /**
     * An array that contains the external dependencies needed to run the worker
     */
    dependencies?: string[];

    onWorkerStatusChange?: (
        status: WebWorkerStatus,
    ) => void;
}

export function useWebWorkerFn<
    T extends (...fnArgs: any[]) => any,
>(fn: T, options: UseWebWorkerOptions = {}) {
    const {
        dependencies = [],
        timeout,
        window = defaultWindow,
        onWorkerStatusChange = () => {},
    } = options;

    let worker: (Worker & { _url?: string }) | undefined;
    let workerStatus: WebWorkerStatus = "PENDING";
    let promise: {
        reject?: (
            result: ReturnType<T> | ErrorEvent,
        ) => void;
        resolve?: (result: ReturnType<T>) => void;
    } = {};
    let timeoutId: number | undefined;

    const setWorkerStatus = (status: WebWorkerStatus) => {
        workerStatus = status;
        onWorkerStatusChange(status);
    };

    //终止worker线程，其会被移除
    const workerTerminate = (
        status: WebWorkerStatus = "PENDING",
    ) => {
        if (worker && worker._url && window) {
            worker.terminate();
            URL.revokeObjectURL(worker._url);
            promise = {};
            worker = void 0;
            window.clearTimeout(timeoutId);
            setWorkerStatus(status);
        }
    };

    workerTerminate();

    const generateWorker = () => {
        const blobUrl = createWorkerBlobUrl(
            fn,
            dependencies,
        );
        const newWorker: Worker & { _url?: string } =
            new Worker(blobUrl);
        newWorker._url = blobUrl;

        newWorker.onmessage = (e: MessageEvent) => {
            const {
                resolve = () => {},
                reject = () => {},
            } = promise;
            const [status, result] = e.data as [
                WebWorkerStatus,
                ReturnType<T>,
            ];

            switch (status) {
                case "SUCCESS":
                    resolve(result);
                    workerTerminate(status);
                    break;
                default:
                    reject(result);
                    workerTerminate("ERROR");
                    break;
            }
        };

        newWorker.onerror = (e: ErrorEvent) => {
            const { reject = () => {} } = promise;
            e.preventDefault();
            reject(e);
            workerTerminate("ERROR");
        };

        if (timeout) {
            timeoutId = setTimeout(
                () => workerTerminate("TIMEOUT_EXPIRED"),
                timeout,
            ) as any;
        }
        return newWorker;
    };

    const callWorker = (...fnArgs: Parameters<T>) =>
        new Promise<ReturnType<T>>((resolve, reject) => {
            promise = {
                resolve,
                reject,
            };
            worker && worker.postMessage([[...fnArgs]]);

            setWorkerStatus("RUNNING");
        });

    const workerFn = (...fnArgs: Parameters<T>) => {
        if (workerStatus === "RUNNING") {
            console.error(
                "[useWebWorkerFn] You can only run one instance of the worker at a time.",
            );
            /* eslint-disable-next-line prefer-promise-reject-errors */
            return Promise.reject();
        }

        worker = generateWorker();
        return callWorker(...fnArgs);
    };

    return {
        workerFn,
        workerStatus,
        workerTerminate,
    };
}
