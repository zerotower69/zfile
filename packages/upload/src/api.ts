import axios, { AxiosResponse } from "axios";
import { isFunction, isObject, merge } from "lodash-es";
import {
    CheckApiReturn,
    MergeApiReturn,
    UploadApiReturn,
    UploadChunk,
    UploadFile,
    UploadActions,
    CheckApi,
    UploadApi,
    MergeApi,
} from "./interface";
import { UploadTask } from "./queue/uploadTask";

const checkTransformResponse: (response: AxiosResponse, chunks: UploadChunk[]) => Awaited<CheckApiReturn> = (
    response: AxiosResponse,
    chunks: UploadChunk[],
) => {
    const data = response.data;
    if (data.success) {
        return {
            success: true,
            response,
        };
    }
    const list: { hash: string; index: number }[] =
        data.data?.map((item: Record<string, any>) => ({
            hash: item.chunk_hash,
            index: item.chunk_number,
        })) ?? [];
    list.sort((pre, cur) => pre.index - cur.index);
    const indexSet = new Set<number>();
    const hashSet = new Set<string>();

    for (let i = 0; i < list.length; i++) {
        indexSet.add(list[i].index);
        hashSet.add(list[i].hash);
    }
    const leftChunks = chunks.filter((chunk) => {
        return !(indexSet.has(chunk.index) && hashSet.has(chunk.hash as string));
    });
    const uploadedChunks = chunks.filter((chunk) => {
        return indexSet.has(chunk.index) && hashSet.has(chunk.hash as string);
    });
    const check = !leftChunks.length;
    return {
        success: check,
        response,
        chunks: leftChunks,
        uploadedChunks,
    };
};

const checkTransformError = (error: any, isCancel: boolean): Awaited<CheckApiReturn> => {
    return {
        success: false,
        error,
        isCancel,
    };
};

const uploadTransformResponse = (response: AxiosResponse): Awaited<UploadApiReturn> => {
    return {
        success: true,
        response,
    };
};

const uploadTransformError = (error: any, isCancel: boolean): Awaited<UploadApiReturn> => {
    return {
        success: false,
        error,
        isCancel,
    };
};

const mergeTransformResponse = (response: AxiosResponse): Awaited<MergeApiReturn> => {
    return {
        success: true,
        response,
    };
};

const mergeTransformError = (error: any, isCancel: boolean): Awaited<MergeApiReturn> => {
    return {
        success: false,
        error,
        isCancel,
    };
};

/**
 * 获取分片检查API
 * @param action
 * @param task
 */
export function getCheckChunkApi(action: UploadActions["check"], task: UploadTask): CheckApi {
    const { action: url, method, timeout, transformPrams, transformData, transformResponse, transformError, retries = 3 } = action;
    //normalize action
    return (file: UploadFile, chunks?: UploadChunk[]) => {
        const params = transformPrams?.call(null, file) ?? {};
        const data = transformData?.call(null, file) ?? {};
        if (isObject(file.params)) {
            merge(params, file.params);
        }
        if (isObject(file.data)) {
            if (data instanceof FormData) {
                Object.entries(file.data).forEach(([key, value]) => {
                    data.append(key, value);
                });
            } else {
                merge(data, file.data);
            }
        }
        return task.uploadQueue
            .request(
                {
                    url: url,
                    method: method,
                    timeout: timeout,
                    params: params,
                    data: data,
                },
                task,
                retries > 0,
                retries,
            )
            .then(
                (resp) => {
                    return isFunction(transformResponse) ? transformResponse(resp, chunks, file) : checkTransformResponse(resp, chunks!);
                },
                (error) =>
                    isFunction(transformError)
                        ? transformError(error, axios.isCancel(error))
                        : checkTransformError(error, axios.isCancel(error)),
            );
    };
}

let uploadId = 1;

/**
 * 获取上传分片API
 * @param action
 * @param task
 */
export function getUploadChunkApi<D = any>(action: UploadActions["upload"], task: UploadTask): UploadApi<D> {
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
    return async function (chunk: UploadChunk, file?: UploadFile) {
        const data = transformData?.call(null, chunk, file) ?? new FormData();
        if (!data.has(fileField)) {
            data.append(fileField, chunk.raw);
        }
        const params = transformParams?.call(null, chunk, file) ?? {};
        return task.uploadQueue
            .request(
                {
                    url: url,
                    method: method,
                    timeout: timeout,
                    data: data,
                    params: {
                        ...params,
                        //_t防止浏览器缓存可能造成的问题
                        _t: Date.now() + uploadId++,
                    },
                },
                task,
                retries > 0,
                retries,
            )
            .then(
                (response) =>
                    isFunction(transformResponse) ? transformResponse(response, chunk, file) : uploadTransformResponse(response),
                (error) =>
                    isFunction(transformError)
                        ? transformError(error, axios.isCancel(error))
                        : uploadTransformError(error, axios.isCancel(error)),
            );
    };
}

/**
 * 获取合并分片API
 * @param action
 * @param task
 */
export function getMergeChunkApi(action: UploadActions["merge"], task: UploadTask): MergeApi {
    const { action: url, method, timeout, transformPrams, transformData, transformResponse, transformError, retries = 3 } = action;
    return async function (file, chunks) {
        const params = transformPrams?.call(null, file, chunks);
        const data = transformData?.call(null, file, chunks);
        return task.uploadQueue
            .request(
                {
                    url: url,
                    method: method,
                    timeout: timeout,
                    params: params,
                    data: data,
                },
                task,
                retries > 0,
                retries,
            )
            .then(
                (response) =>
                    isFunction(transformResponse) ? transformResponse(response, file, chunks) : mergeTransformResponse(response),
                (error) =>
                    isFunction(transformError)
                        ? transformError(error, axios.isCancel(error))
                        : mergeTransformError(error, axios.isCancel(error)),
            );
    };
}
type RetryFn<T = any> = () => Promise<T>;
export async function retryAsyncFn<T = any>(fn: RetryFn<T>, retries: number) {
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
