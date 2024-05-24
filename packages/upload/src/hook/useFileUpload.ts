import { UploadQueue } from "../queue/uploadQueue";
import type { UploadQueueOptions } from "../interface";

export function useFileUpload(options: UploadQueueOptions) {
    const uploadQueue = new UploadQueue(options);

    function upload(file: File, data: Record<string, any>) {
        return uploadQueue.add(file, data);
    }

    return {
        upload,
    };
}
