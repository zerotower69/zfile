import {UseUploadOptions} from "./interface";
import {FileQueue} from "./task/FileQueue.ts";

export function useBigUpload(options:UseUploadOptions){
    const {
        // accept='',
        // multiple=false,
        chunkSize = 1024*1024,
        withCredentials=false,
        headers,
        parallel=2,
        onProgress
    } = options
    const queue = new FileQueue({
        actions:options.actions,
        chunkSize:chunkSize,
        withCredentials,
        headers,
        parallel,
        onProgress
    })
    function upload(...files:File[]){
          queue.addFile(files);
    }
    return {
        upload
    }
}
