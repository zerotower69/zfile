import axios from "axios";
import type { RawAxiosRequestHeaders } from "axios";
import {
    UploadChunk,
    UploadFile,
    UploadActions,
    CheckApi,
    UploadApi,
    MergeApi,
} from "./interface";
import { UploadTask } from "./queue/uploadTask";
import { isBoolean, normalizeUrl } from "./utils";
import { isFunction } from "lodash-es";

/**
 * 获取分片检查API
 * @param action
 * @param task
 */
export function getCheckChunkApi(
    action: UploadActions["check"],
    task: UploadTask,
): CheckApi {
    const {
        action: url,
        method,
        timeout,
        transformPrams,
        transformData,
        transformResponse,
        transformError,
        retries = 3,
    } = action;
    //compute headers
    let headers: RawAxiosRequestHeaders =
        task.uploadQueue.defHttp.defaults.headers;
    if (isFunction(action.headers)) {
        headers = action.headers() || {};
    } else if (
        isBoolean(action.headers) &&
        !action.headers
    ) {
        headers = {};
    } else {
        headers =
            (action.headers as RawAxiosRequestHeaders) ||
            {};
    }
    //normalize action
    return (file: UploadFile, chunks?: UploadChunk[]) => {
        const params =
            transformPrams?.call(null, file) ?? {};
        const data = transformData?.call(null, file) ?? {};
        return task.uploadQueue
            .request(
                {
                    url: normalizeUrl(
                        url,
                        task.uploadQueue.actions.baseURL,
                    ),
                    method: method,
                    timeout: timeout,
                    params: params,
                    data: data,
                    headers,
                },
                task,
                retries > 0,
                retries,
            )
            .then(
                (resp) => {
                    return transformResponse(
                        resp,
                        chunks,
                        file,
                    );
                },
                (error) =>
                    transformError(
                        error,
                        axios.isCancel(error),
                    ),
            );
    };
}

let uploadId = 1;

/**
 * 获取上传分片API
 * @param action
 * @param task
 */
export function getUploadChunkApi<D = any>(
    action: UploadActions["upload"],
    task: UploadTask,
): UploadApi<D> {
    const {
        action: url,
        method,
        file: fileField = "file",
        timeout,
        transformData,
        transformParams,
        transformResponse,
        transformError,
        retries = 3,
    } = action;
    //compute headers
    let headers: RawAxiosRequestHeaders =
        task.uploadQueue.defHttp.defaults.headers;
    if (isFunction(action.headers)) {
        headers = action.headers() || {};
    } else if (
        isBoolean(action.headers) &&
        !action.headers
    ) {
        headers = {};
    } else {
        headers =
            (action.headers as RawAxiosRequestHeaders) ||
            {};
    }
    return async function (
        chunk: UploadChunk,
        file?: UploadFile,
    ) {
        const data =
            transformData?.call(null, chunk, file) ??
            new FormData();
        if (!data.has(fileField)) {
            data.append(fileField, chunk.raw);
        }
        const params =
            transformParams?.call(null, chunk, file) ?? {};
        return task.uploadQueue
            .request(
                {
                    url: normalizeUrl(
                        url,
                        task.actions.baseURL,
                    ),
                    method: method,
                    timeout: timeout,
                    data: data,
                    params: {
                        ...params,
                        //_t防止浏览器缓存可能造成的问题
                        _t: Date.now() + uploadId++,
                    },
                    headers,
                },
                task,
                retries > 0,
                retries,
            )
            .then(
                (response) =>
                    transformResponse(
                        response,
                        chunk,
                        file,
                    ),
                (error) =>
                    transformError(
                        error,
                        axios.isCancel(error),
                    ),
            );
    };
}

/**
 * 获取合并分片API
 * @param action
 * @param task
 */
export function getMergeChunkApi(
    action: UploadActions["merge"],
    task: UploadTask,
): MergeApi {
    const {
        action: url,
        method,
        timeout,
        transformPrams,
        transformData,
        transformResponse,
        transformError,
        retries = 3,
    } = action;
    //compute headers
    let headers: RawAxiosRequestHeaders =
        task.uploadQueue.defHttp.defaults.headers;
    if (isFunction(action.headers)) {
        headers = action.headers() || {};
    } else if (
        isBoolean(action.headers) &&
        !action.headers
    ) {
        headers = {};
    } else {
        headers =
            (action.headers as RawAxiosRequestHeaders) ||
            {};
    }
    return async function (file, chunks) {
        const params = transformPrams?.call(
            null,
            file,
            chunks,
        );
        const data = transformData?.call(
            null,
            file,
            chunks,
        );
        return task.uploadQueue
            .request(
                {
                    url: normalizeUrl(
                        url,
                        task.actions.baseURL,
                    ),
                    method: method,
                    timeout: timeout,
                    params: params,
                    data: data,
                    headers,
                },
                task,
                retries > 0,
                retries,
            )
            .then(
                (response) =>
                    transformResponse(
                        response,
                        file,
                        chunks,
                    ),
                (error) =>
                    transformError(
                        error,
                        axios.isCancel(error),
                    ),
            );
    };
}
type RetryFn<T = any> = () => Promise<T>;
export async function retryAsyncFn<T = any>(
    fn: RetryFn<T>,
    retries: number,
) {
    let retriesCount = 0;
    return new Promise<T>((resolve, reject) => {
        async function recurveFn() {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                retriesCount++;
                try {
                    const res = await fn();
                    resolve(res);
                    break;
                } catch (err) {
                    if (retriesCount === retries) {
                        reject(err);
                        break;
                    }
                }
            }
        }
        recurveFn();
    });
}
