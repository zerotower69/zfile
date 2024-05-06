import { UploadQueue, UploadQueueOptions } from "../queue/uploadQueue";

export function useFileUpload(options: UploadQueueOptions) {
    const uploadQueue = new UploadQueue(options);

    function upload(file: File) {
        return uploadQueue.add(file);
    }

    return {
        upload,
    };
}
