import { FileStatus, UploadFile, UploadRawFile } from "../interface.ts";
import { UploadActions } from "../request/interface.ts";
import { genFileId } from "../helpers.ts";
import { isArray } from "lodash-es";
import { FileTaskQueue } from "./FileTaskQueue.ts";
import { AxiosHeaders } from "axios";

export interface FileQueueOption {
    actions: UploadActions;
    withCredentials: boolean;
    chunkSize: number;
    headers?: AxiosHeaders;
    parallel?: 1 | 2 | 3;
    onProgress?: (file: UploadFile, percentage: number) => void;
}

export class FileQueue {
    queue: UploadFile[];
    options: FileQueueOption;
    taskQueue: FileTaskQueue;
    constructor(options: FileQueueOption) {
        this.options = options;
        this.queue = [];
        this.taskQueue = new FileTaskQueue({
            ...this.options,
            fileQueue: this,
        });
    }
    addFile(files: File | File[]) {
        if (isArray(files)) {
            files.forEach((file) => {
                this.addOneFile(file);
            });
        } else {
            this.addOneFile(files);
        }
    }

    get onProgress() {
        return this.options.onProgress;
    }

    private addOneFile(file: File) {
        this.initFile(file);
        this.taskQueue.start();
    }

    private initFile(file: File) {
        const uid = genFileId();
        const rawFile = file as UploadRawFile;
        rawFile.uid = uid;
        const chunkSize = this.options.chunkSize as number;
        this.queue.push({
            uid,
            name: file.name,
            size: file.size,
            status: FileStatus.WAITING,
            chunkSize,
            total: Math.ceil(file.size / chunkSize),
            raw: rawFile,
        });
    }
}
