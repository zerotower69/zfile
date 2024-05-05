import { AxiosHeaders, AxiosProgressEvent, AxiosRequestConfig, AxiosResponse, Method } from "axios";
import { UploadChunk, UploadFile } from "../interface";

export type RequestURL = string;

export interface RequestQueueOptions {
    timeout?: number;
    headers?: AxiosHeaders;
    withCredentials?: boolean;
}

export type RequestTaskFn<T = any> = (config: AxiosRequestConfig) => () => Promise<AxiosResponse<T>>;

export interface UseRequestQueueReturn {
    request: RequestTaskFn;
    cancel: (message?: string) => void;
}
export type CheckApiReturn = Promise<UploadChunk[]>;
export type UploadApiReturn<D = any> = Promise<AxiosResponse<D>>;
export type MergeApiReturn = Promise<boolean>;

export type UploadActionProgress = (percentage: number, chunk?: UploadChunk, evt?: AxiosProgressEvent) => void;

export type CheckApi = (file: UploadFile, chunks?: UploadChunk[]) => CheckApiReturn;
export type UploadApi<D = any> = (chunk: UploadChunk, file?: UploadFile, onProgress?: UploadActionProgress) => UploadApiReturn<D>;
export type MergeApi = (file: UploadFile, chunks?: UploadChunk[]) => MergeApiReturn;

export type CheckActionStrategy<T = any> = (response: AxiosResponse<T>, file: UploadFile, chunks: UploadChunk[]) => UploadChunk[];

export interface CheckAction {
    action: string;
    method: Method | string;
    transformPrams?: (file: UploadFile) => Record<string, any>;
    transformData?: (file: UploadFile) => FormData | Record<string, any>;
    strategy?: CheckActionStrategy;
    timeout?: number;
}
export interface UploadAction {
    action: string;
    method: Method | string;
    /**
     * default: 'file'
     */
    file?: string;
    transformData?: (chunk?: UploadChunk, file?: UploadFile) => FormData;
    transformParams?: (chunk?: UploadChunk, file?: UploadFile) => Record<string, any>;
    timeout?: number;
    onProgress?: UploadActionProgress;
}

export interface MergeAction {
    action: string;
    method: Method | string;
    transformPrams?: (file: UploadFile, chunks?: UploadChunk[]) => Record<string, any>;
    transformData?: (file: UploadFile, chunks?: UploadChunk[]) => FormData | Record<string, any>;
    timeout?: number;
}

export interface UploadActions {
    upload: UploadAction;
    check: CheckAction;
    merge: MergeAction;
}
