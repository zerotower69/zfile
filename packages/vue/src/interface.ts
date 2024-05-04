import {AxiosHeaders, AxiosProgressEvent} from "axios";
import {UploadActions} from "./request/interface.ts";

export interface UploadFile {
   name:string;
   status:FileStatus,
   size:number;
   uid:number;
   raw:UploadRawFile;
   chunkSize:number;
   total:number;
   hash?:string;
   percentage?:number;
   chunks?:UploadChunk[]
}

export interface UploadChunk {
    filename:string;
    raw:Blob;
    uid:number;
    size:number;
    index:number;
    originFile?:UploadFile
    status?:FileStatus;
    percentage?:number;
    hash?:string;
}
export interface UploadRawFile extends File {
    uid:number;
}

export enum FileStatus {
    WAITING ="waiting",
    READING = "reading",
    READY ="ready",
    UPLOADING = "uploading",
    PENDING ="pending",
    SUCCESS = "success",
    FAIL = "fail"
}

export interface UseUploadOptions {
    /**
     * TODO:允许上传多个文件
     */
    multiple?:boolean;
    /**
     * 限制上传个数
     */
    limit?: number;
    /**
     * 单个文件限制总大小
     */
    allowMaxSize?: number;
    /**
     * 接受的文件类型，和原生input[type="file"]的 accept属性一致
     */
    accept?:string;
    /**
     * 文件的切片大小，小于该大小的文件不被切片，且
     */
    chunkSize?:number
    actions:UploadActions
    headers?: AxiosHeaders
    withCredentials?: boolean;
    /**
     *
     */
    parallel?:1|2|3,
    onProgress?:(file:UploadFile,percentage:number)=>void
    onFileChange?:(files?:File[],fileQueue?:UploadFile[])=>void
}

export interface UserUploadReturn {
    upload:(limit:number)=>void
}

export interface UploadProgressEvent extends ProgressEvent {
    percent: number
}

export interface NormalAjaxOptions {
    type:"normal",
    url: string
    method: string
    data: Record<string, string | Blob | [string | Blob, string]>
    headers: Headers | Record<string, string | number | null | undefined>
    onError: (evt: BigFileRequestError) => void
    onProgress?: (evt: UploadProgressEvent) => void
    onSuccess: (response: any) => void
    withCredentials: boolean
}

export interface UploadOptions {
    url: string
    method: string
    headers: AxiosHeaders
    onError?: (evt: BigFileRequestError) => void
    onProgress?: (evt: AxiosProgressEvent) => void
    onSuccess?: (response: any) => void
    withCredentials: boolean
}

export interface StartUploadOptions {
    data:Record<string, any>,
    fileField:string
    chunk:Blob;
    onProgress?:(evt:AxiosProgressEvent)=>void;
}

export class BigFileRequestError extends Error {
    name = 'BigFileRequestError'

    constructor(message: string) {
        super(message)
    }
}
