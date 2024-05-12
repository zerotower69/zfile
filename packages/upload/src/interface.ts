import {
    AxiosHeaders,
    AxiosProgressEvent,
    AxiosResponse,
    Method,
} from "axios";
import { UploadTask } from "./queue/uploadTask";
import { BigFileError } from "./utils";

export interface UploadFile {
    name: string;
    size: number;
    humanSize: string;
    uid: number;
    raw: UploadRawFile;
    chunkSize: number;
    total: number;
    hash?: string;
    percentage?: number;
    params?: Record<string, any>;
    data?: Record<string, any>;
    chunks?: UploadChunk[];
    uploaded: number;
    status: UploadStatus;
    task?: UploadTask;
}

export interface UploadChunk {
    filename: string;
    raw: Blob;
    uid: number;
    size: number;
    index: number;
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

export interface RequestQueueOptions {
    timeout?: number;
    headers?: AxiosHeaders;
    withCredentials?: boolean;
}

export type CheckApiReturn<D = any> = Promise<{
    success: boolean;
    chunks?: UploadChunk[];
    uploadedChunks?: UploadChunk[];
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

export interface CheckAction {
    /**
     * 切片检查接口路径
     */
    action: string;
    /**
     * 请求方式
     */
    method: Method | string;
    /**
     * params参数转换
     * @see
     * @param file 上传文件对象，可以从其中拿到切片信息
     */
    transformPrams?: (
        file: UploadFile,
    ) => Record<string, any>;
    /**
     * body请求信息，结合实际业务需要指定
     * @param file 上传文件对象，可以从其中拿到切片信息
     */
    transformData?: (
        file: UploadFile,
    ) => FormData | Record<string, any>;
    /**
     * 响应成功处理，结合业务需要转换
     */
    transformResponse?: (
        response: AxiosResponse,
        chunks: UploadChunk[],
        file: UploadFile,
    ) => CheckApiReturn;
    /**
     * 响应错误处理
     * @param error 错误
     * @param isCancel 接口是否手动取消
     */
    transformError?: (
        error: any,
        isCancel: boolean,
    ) => CheckApiReturn;
    /**
     * 接口响应超时
     */
    timeout?: number;
    /**
     * 接口重试次数，默认3。设置为0表示不重试，如果由于暂停、删除操作等自动取消接口则不生效
     */
    retries?: number;
}
export interface UploadAction {
    /**
     * 切片上传接口路径
     */
    action: string;
    /**
     * 请求方法（post）
     */
    method: Method | string;
    /**
     * 切片上传的文件字段名，默认“file”
     */
    file?: string;
    /**
     * params参数转换
     * @param chunk 切片
     * @param file 上传文件对象，可取出其它信息
     */
    transformParams?: (
        chunk: UploadChunk,
        file: UploadFile,
    ) => Record<string, any>;
    /**
     * body请求信息，结合实际业务需要指定
     * @param chunk 切片
     * @param file 上传文件对象，UploadFile
     */
    transformData?: (
        chunk: UploadChunk,
        file: UploadFile,
    ) => FormData;
    /**
     * 响应成功处理，结合业务需要转换
     */
    transformResponse?: (
        response: AxiosResponse,
        chunk: UploadChunk,
        file: UploadFile,
    ) => UploadApiReturn;
    /**
     * 响应错误处理
     * @param error 错误
     * @param isCancel 接口是否手动取消
     */
    transformError?: (
        error: any,
        isCancel: boolean,
    ) => UploadApiReturn;
    /**
     * 接口响应超时
     */
    timeout?: number;
    /**
     * 接口重试次数，默认3。设置为0表示不重试，如果由于暂停、删除操作等自动取消接口则不生效
     */
    retries?: number;
    /**
     * 切片上传进度回调
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
export interface MergeAction {
    /**
     * 切片合并接口路径
     */
    action: string;
    /**
     * 请求方式
     */
    method: Method | string;
    /**
     * params参数转换
     * @param file 上传文件对象
     * @param chunks 所有的切片信息
     */
    transformPrams?: (
        file: UploadFile,
        chunks: UploadChunk[],
    ) => Record<string, any>;
    /**
     * body 请求信息，根据业务需要给定
     * @param file 上传文件对象
     * @param chunks 所有的切片信息
     */
    transformData?: (
        file: UploadFile,
        chunks: UploadChunk[],
    ) => FormData | Record<string, any>;
    /**
     * 响应成功处理
     */
    transformResponse?: (
        response: AxiosResponse,
        file: UploadFile,
        chunks: UploadChunk[],
    ) => MergeApiReturn;
    /**
     * 响应失败处理
     * @param error 错误信息
     * @param isCancel 接口是否手动取消
     */
    transformError?: (
        error: any,
        isCancel: boolean,
    ) => MergeApiReturn;
    /**
     * 接口响应超时
     */
    timeout?: number;
    /**
     * 接口重试次数，默认3。设置为0表示不重试，如果由于暂停、删除操作等自动取消接口则不生效
     */
    retries?: number;
}

export interface UploadActions {
    baseURL?: string;
    upload: UploadAction;
    check: CheckAction;
    merge: MergeAction;
}

//接口并发数 1-6
export type RequestLimit = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * worker配置
 */
export interface WorkerConfig {
    /**
     *允许最大线程数，开发时，可通过navigator.hardwareConcurrency查看机器上允许的最大线程数
     */
    thread?: number;
    /**
     * 文件切片并发，允许多少个文件同时切片
     */
    parallel?: number;
    /**
     * 切片响应超时，如果超过指定时间为完成切片，将终止所有相关的worker线程，切片失败。默认：5*60*1000
     */
    timeout?: number;
    /**
     * 指定worker中 spark-md5 引用的资源路径
     */
    spark_md5_url?: string;
}

export interface UploadQueueOptions {
    actions: UploadActions;
    /**
     * 是否携带cookie,默认false
     */
    withCredentials?: boolean;
    /**
     * 分片大小,默认1MB
     */
    chunkSize?: number;
    /**
     * 全局请求头,可用来设置token
     */
    headers?: AxiosHeaders;
    /**
     * 全局接口超时，默认10s(10*1000ms)
     */
    timeout?: number;
    /**
     * 接口并发数
     */
    requestLimit?: RequestLimit;
    /**
     * 文件并发上传数
     */
    parallel?: 1 | 2 | 3;
    /**
     * 重试次数，默认3次
     */
    maxRetries?: number;
    /**
     * worker线程配置
     */
    worker?: WorkerConfig;
    /**
     * 进度回调
     * @param file 上传文件
     * @param percentage 进度
     * @param 自定义进度事件
     */
    onProgress?: (
        percentage: number,
        file: UploadFile,
        files: UploadFile[],
        event: UploadProgressEvent,
    ) => void;
    /**
     * 文件变化，当增加或者移除时
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
     * 文件上传成功时
     * @param file
     */
    onSuccess?: (file: UploadFile) => void;
    /**
     * 上传文件状态变化时
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
     *开始切片
     * @param file
     * @param files
     */
    onSliceStart?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * 切片结束
     * @param file
     * @param files
     */
    onSliceEnd?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    onSliceError?: (
        error: BigFileError,
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * 开始上传触发的回调
     * @param file
     * @param files
     */
    onUploadStart?: (
        file: UploadFile,
        files: UploadFile[],
    ) => void;
    /**
     * 上传时发生的错误
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
     * 网络中断时触发
     * @param files
     */
    onOffline?: (files: UploadFile[]) => void;
    /**
     *网络恢复时触发
     * @param files
     */
    onLine?: (files: UploadFile[]) => void;
    /**
     * 上传取消时触发
     * @param message 取消理由
     * @param file
     * @param files
     */
    onCancel?: (
        message: string,
        file: UploadFile,
        files: UploadFile[],
    ) => void;
}
