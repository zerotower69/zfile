import type {
    RawAxiosRequestHeaders,
    AxiosProgressEvent,
    AxiosResponse,
    Method,
} from "axios";
import { UploadTask } from "./queue/uploadTask";
import { BigFileError } from "./utils";

export interface UploadFile {
    /**
     * the name of upload file
     */
    name: string;
    /**
     * the size of upload file
     */
    size: number;
    /**
     * the beautiful format uploaded size for human
     */
    humanSize: string;
    /**
     * unique id
     */
    uid: number;
    /**
     * original JavaScript File object
     */
    raw: UploadRawFile;
    /**
     * the size of chunk
     */
    chunkSize: number;
    /**
     * the size of file
     */
    total: number;
    /**
     * the unique hash of file
     */
    hash?: string;
    /**
     * the progress of uploaded
     */
    percentage?: number;
    /**
     * extract params
     */
    params?: Record<string, any>;
    /**
     * extract fields
     */
    data?: Record<string, any>;
    /**
     * all slicing chunks
     */
    chunks?: UploadChunk[];
    /**
     * the number of already uploaded
     */
    uploaded: number;
    /**
     * the status of file
     */
    status: UploadStatus;
    /**
     * upload task
     */
    task?: UploadTask;
}

export interface UploadChunk {
    /**
     * the name of original file
     */
    filename: string;
    /**
     * raw chunk data
     */
    raw: Blob;
    /**
     * unique value
     */
    uid: number;
    /**
     * the size of chunk
     */
    size: number;
    /**
     * the sequence of chunk
     */
    index: number;
    /**
     * original UploadFile object
     */
    originFile?: UploadFile;
    percentage?: number;
    hash?: string;
}
export interface UploadRawFile extends File {
    uid: number;
}

export interface UploadProgressEvent {
    rate: number;
    rateText: string;
    uploaded: number;
    size: number;
    leftTime: number;
    percentage: number;
    file: UploadFile;
    raw: UploadRawFile;
}

/**
 * the enum of the status of UploadFile
 */
export enum UploadStatus {
    WAITING = "waiting",
    READING = "reading",
    READY = "ready",
    UPLOADING = "uploading",
    PENDING = "pending",
    FAILED = "failed",
    CANCEL = "cancel",
    OFFLINE = "offline",
    MERGING = "merging",
    SUCCESS = "success",
}

export type CheckApiReturn<D = any> = Promise<{
    /**
     * the file exit or not
     */
    success: boolean;
    /**
     *  the chunks of will be uploaded
     */
    chunks?: UploadChunk[];
    /**
     * the chunks of already be uploaded
     */
    uploadedChunks?: UploadChunk[];
    /**
     * the response of axios response
     */
    response?: AxiosResponse<D>;
    error?: any;
    isCancel?: boolean;
}>;
export type UploadApiReturn<D = any> = Promise<{
    success: boolean;
    response?: AxiosResponse<D>;
    error?: any;
    isCancel?: boolean;
}>;
export type MergeApiReturn<D = any> = Promise<{
    success: boolean;
    response?: AxiosResponse<D>;
    error?: any;
    isCancel?: boolean;
}>;

export type UploadActionProgress = (
    percentage: number,
    chunk?: UploadChunk,
    evt?: AxiosProgressEvent,
) => void;

export type CheckApi = (
    file: UploadFile,
    chunks?: UploadChunk[],
) => CheckApiReturn;
export type UploadApi<D = any> = (
    chunk: UploadChunk,
    file?: UploadFile,
    onProgress?: UploadActionProgress,
) => UploadApiReturn<D>;
export type MergeApi = (
    file: UploadFile,
    chunks?: UploadChunk[],
) => MergeApiReturn;

/**
 * check file api action,to check the file exit or not
 */
export interface CheckAction {
    /**
     * the request url of check file
     */
    action: string;
    /**
     * the request method of check file
     */
    method: Method | string;
    /**
     * the request headers of check file, you can use to set your token.
     */
    headers?:
        | RawAxiosRequestHeaders
        | boolean
        | (() => RawAxiosRequestHeaders);
    /**
     * transform to request params
     * @see
     * @param file upload file object
     */
    transformPrams?: (
        file: UploadFile,
    ) => Record<string, any>;
    /**
     * request body, you must set it by your real need.
     * @param file upload file object
     */
    transformData?: (
        file: UploadFile,
    ) => FormData | Record<string, any>;
    /**
     * transform raw axios response to check api response, you must set it to make sure all right.
     */
    transformResponse: (
        response: AxiosResponse,
        chunks: UploadChunk[],
        file: UploadFile,
    ) => Awaited<CheckApiReturn>;
    /**
     * transform raw axios Error to the request error of check api.
     * @param error Error
     * @param isCancel if true, means the error of check api because of canceling.
     */
    transformError: (
        error: any,
        isCancel: boolean,
    ) => Awaited<CheckApiReturn>;
    /**
     * the request timeout of check api, default 10s(unit:ms)
     */
    timeout?: number;
    /**
     * when the error of request happened, request will try again until the count of retries is equal "retries",
     * but it will not be effective, which the error due to canceling or pause
     */
    retries?: number;
}
export interface UploadAction {
    /**
     * the request url of upload single chunk
     */
    action: string;
    /**
     * the request method of upload single chunk, suggest use "post"
     */
    method: Method | string;
    /**
     * the request headers of upload single chunk, you can use to set your token.
     */
    headers?:
        | RawAxiosRequestHeaders
        | boolean
        | (() => RawAxiosRequestHeaders);
    /**
     * the name field of upload chunk, default: "file"
     */
    file?: string;
    /**
     * transform data to the request params of upload request
     * @param chunk will upload chunk
     * @param file uploaded file object
     */
    transformParams?: (
        chunk: UploadChunk,
        file: UploadFile,
    ) => Record<string, any>;
    /**
     * request body, you must set it by your real need.
     * @param chunk will upload chunk
     * @param file uploaded file object
     */
    transformData?: (
        chunk: UploadChunk,
        file: UploadFile,
    ) => FormData;
    /**
     * transform raw axios response to upload api response, you must set it to make sure all right.
     */
    transformResponse: (
        response: AxiosResponse,
        chunk: UploadChunk,
        file: UploadFile,
    ) => Awaited<UploadApiReturn>;
    /**
     * transform raw axios Error to the request error of upload api.
     * @param error Error
     * @param isCancel if true, means the error of check api because of canceling.
     */
    transformError: (
        error: any,
        isCancel: boolean,
    ) => Awaited<UploadApiReturn>;
    /**
     * the request timeout of upload api, default 10s(unit:ms)
     */
    timeout?: number;
    /**
     * when the error of request happened, request will try again until the count of retries is equal "retries",
     * but it will not be effective, which the error due to canceling or pause
     */
    retries?: number;
    /**
     * will be called when the progress of file change, it's designed to monitor the progress of file
     * @param percentage 进度
     * @param chunk UploadChunk
     * @param evt Axios 进度事件
     */
    onProgress?: (
        percentage: number,
        chunk: UploadChunk,
        evt: AxiosProgressEvent,
    ) => void;
}

//TODO:允许merge之后再加入业务处理逻辑

/**
 * merge file action
 */
export interface MergeAction {
    /**
     * the request url of merge file
     */
    action: string;
    /**
     * the method of merge file request
     */
    method: Method | string;
    /**
     * the request headers of merge api, you can use to set your token.
     */
    headers?:
        | RawAxiosRequestHeaders
        | boolean
        | (() => RawAxiosRequestHeaders);
    /**
     * p
     * @param file UploadFile object
     * @param chunks  the chunks of file
     */
    transformPrams?: (
        file: UploadFile,
        chunks: UploadChunk[],
    ) => Record<string, any>;
    /**
     * transform data to the request params of merge api
     * @param file UploadFile object
     * @param chunks the chunks of file
     */
    transformData?: (
        file: UploadFile,
        chunks: UploadChunk[],
    ) => FormData | Record<string, any>;
    /**
     * transform raw axios response to merge api response, you must set it to make sure all right.
     */
    transformResponse: (
        response: AxiosResponse,
        file: UploadFile,
        chunks: UploadChunk[],
    ) => Awaited<MergeApiReturn>;
    /**
     * transform raw axios Error to the request error of merge api.
     * @param error Error
     * @param isCancel if true, means the error of merge api because of canceling.
     */
    transformError: (
        error: any,
        isCancel: boolean,
    ) => Awaited<MergeApiReturn>;
    /**
     * the request timeout of merge api, default 10s(unit:ms)
     */
    timeout?: number;
    /**
     * when the error of request happened, request will try again until the count of retries is equal "retries",
     * but it will not be effective, which the error due to canceling or pause
     */
    retries?: number;
}

export interface UploadActions {
    baseURL?: string;
    upload: UploadAction;
    check: CheckAction;
    merge: MergeAction;
}

/**
 * the number of concurrent requests
 */
export type RequestLimit = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * the config of web worker
 */
export interface WorkerConfig {
    /**
     * the max number if thread by web worker.
     * You can use navigator.hardwareConcurrency to get max number of your machine.
     */
    thread?: number;
    /**
     * the max number of files can be sliced to chunks at the same time
     */
    parallel?: number;
    /**
     * the slicing operate should be finished less than timeout (unit:ms)
     * @default 5*60*1000(5min)
     */
    timeout?: number;
    /**
     * the path of sparkMD5 javascript file
     */
    spark_md5_url?: string;
}

export interface UploadQueueOptions {
    actions: UploadActions;
    /**
     * with cookie
     * @default false
     */
    withCredentials?: boolean;
    /**
     * the slicing size of every chunk of file (unit:byte)
     * @default 1024*1024
     */
    chunkSize?: number;
    /**
     * global request headers, you can use it to set your token
     */
    headers?:
        | RawAxiosRequestHeaders
        | (() => RawAxiosRequestHeaders);
    /**
     * global request timeout (unit: ms)
     * @default 10*1000
     */
    timeout?: number;
    /**
     * the max number of request at the same time
     * @default 6
     */
    requestLimit?: RequestLimit;
    /**
     * the number of allow upload file at the same time
     */
    parallel?: 1 | 2 | 3;
    /**
     * the number of try request
     * @default 3
     */
    maxRetries?: number;
    /**
     * the config of web worker
     */
    worker?: WorkerConfig;
    /**
     * will be called when the progress of file change
     * @param file
     * @param percentage
     * @param event upload progress event
     */
    onProgress?: (
        percentage: number,
        file: UploadFile,
        files: UploadFile[],
        event: UploadProgressEvent,
    ) => void;
    /**
     * will be called when add file or remove file
     * @param file
     * @param files
     * @param type
     */
    onFileChange?: (
        file: UploadFile,
        files: UploadFile[],
        type: "add" | "remove",
    ) => void;
    /**
     * will be called when the file upload successfully
     * @param file
     */
    onSuccess?: (file: UploadFile) => void;
    /**
     * will be called when the status of uploadFile change
     * @param status
     * @param oldStatus
     * @param file
     */
    onStatusChange?: (
        status: UploadStatus,
        oldStatus: UploadStatus,
        file: UploadFile,
    ) => void;
    /**
     * will be called when slicing chunks start
     * @param file
     * @param files
     */
    onSliceStart?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * will be called when slicing chunk finish
     * @param file
     * @param files
     */
    onSliceEnd?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * will be called when slicing chunks error happened
     * @param error request error
     * @param file single upload file
     * @param files all upload files
     */
    onSliceError?: (
        error: BigFileError,
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * will be called when single upload file start request
     * @param file
     * @param files
     */
    onUploadStart?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * will be called when request error happened
     * @param error
     * @param file
     * @param files
     */
    onUploadError?: (
        error: BigFileError,
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * will be called when the status of network from "online" to "offline"
     * @param files all upload files
     */
    onOffline?: (files: UploadFile[]) => void;
    /**
     * will be called when the status of network from "offline" to "online"
     * @param files all uploaded files
     */
    onLine?: (files: UploadFile[]) => void;
    /**
     * will be called when the upload operation be canceling
     * @param message the reason of canceling
     * @param file single upload file
     * @param files all upload files
     */
    onCancel?: (
        message: string,
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * will be called when the file already upload
     * @param file
     * @param files
     */
    onSkipUpload?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * merge API request will be sent when the file already upload
     * @default false
     */
    stillMergeAfterSkip?: boolean;
}
