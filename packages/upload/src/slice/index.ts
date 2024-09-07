import { getConcurrency } from "../utils";
import { useWebWorkerFn, WebWorkerStatus } from "../worker";
import {
    UploadChunk,
    UploadFile,
    UploadRawFile,
} from "../interface";

interface SliceReturn {
    fileHash: string;
    fileChunks: UploadChunk[];
}

export interface UseSliceFileReturn {
    start: () => Promise<SliceReturn>;
    stop: () => void;
}

/**
 * 在web worker里完成每个chunk的切片
 * @param timeout 切片超时，默认 5min(5*60*1000ms)
 * @param SPARK_MD5_URL spark-md5 路径，可以为CDN,也可以是本地静态资源路径
 */
export function sliceFile(
    timeout = 5 * 60 * 1000,
    SPARK_MD5_URL = "https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M/spark-md5/3.0.2/spark-md5.min.js",
) {
    return useWebWorkerFn<
        (data: {
            fileUid: number;
            file: UploadRawFile;
            chunkSize: number;
            start: number;
            end: number;
        }) => SliceReturn
    >(
        //@ts-ignore
        (data) => {
            return new Promise((resolve, reject) => {
                const {
                    fileUid,
                    file,
                    chunkSize,
                    start,
                    end,
                } = data;
                //@ts-ignore
                const SparkMD5 = self.SparkMD5;
                const blobSlice = File.prototype.slice;
                const spark =
                    //@ts-ignore
                    new SparkMD5.ArrayBuffer();
                const fileChunks: UploadChunk[] = [];
                const fileReader = new FileReader();
                let currentIndex = start;
                let currentChunk = blobSlice.call(
                    file,
                    0,
                    chunkSize,
                );
                let current: UploadChunk | null = null;
                function loadNext() {
                    const startPos =
                            currentIndex * chunkSize,
                        endPos = Math.min(
                            startPos + chunkSize,
                            file.size,
                        );

                    currentChunk = blobSlice.call(
                        file,
                        startPos,
                        endPos,
                    );
                    current = {
                        raw: currentChunk,
                        filename: file.name,
                        index: currentIndex,
                        uid: fileUid + currentIndex,
                        size: currentChunk.size,
                    };
                    fileReader.readAsArrayBuffer(
                        currentChunk,
                    );
                }

                // 处理每一块的分片
                fileReader.onload = function (e) {
                    spark.append(
                        e.target!.result as ArrayBuffer,
                    ); // Append array buffer
                    currentIndex++;

                    const chunkSpark =
                        //@ts-ignore
                        new SparkMD5.ArrayBuffer();
                    chunkSpark.append(
                        e.target!.result as ArrayBuffer,
                    );
                    current!.hash = chunkSpark.end();
                    fileChunks.push(current!);
                    const startPos =
                            currentIndex * chunkSize,
                        endPos = Math.min(
                            startPos + chunkSize,
                            file.size,
                        );
                    if (
                        currentIndex > end ||
                        startPos >= endPos
                    ) {
                        // 计算完成后，返回结果
                        resolve({
                            fileHash: spark.end(),
                            fileChunks,
                        });
                        fileReader.abort();
                    } else {
                        loadNext();
                    }
                };

                // 读取失败
                fileReader.onerror = function () {
                    reject("read blob error");
                };
                loadNext();
            });
        },
        {
            timeout: timeout,
            dependencies: [SPARK_MD5_URL],
        },
    );
}

/**
 * 使用单线程分片并计算文件hash(文件全增量策略)
 * @param file
 */
export function singleSliceFile(file: UploadFile) {
    const { workerFn, workerTerminate } = sliceFile();
    const chunks = file.total;
    function start() {
        const p = workerFn({
            fileUid: file.uid,
            file: file.raw as UploadRawFile,
            chunkSize: file.chunkSize,
            start: 0,
            end: chunks,
        });
        p.finally(() => {
            workerTerminate();
        });
        return p;
    }
    function stop(status?: WebWorkerStatus) {
        workerTerminate(status);
    }
    return {
        start,
        stop,
    };
}

/**
 * 使用多个线程分片和计算文件hash(分片hash排序策略)
 * @param file
 * @param timeout
 * @param url
 * @param chunkSize
 */
export function multipleSliceFile(
    file: UploadFile,
    timeout = 5 * 60 * 1000,
    url = "https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M/spark-md5/3.0.2/spark-md5.min.js",
    chunkSize = 1024 * 1024,
): UseSliceFileReturn {
    const { workerFn, workerTerminate } = useWebWorkerFn(
        async (data: {
            file: UploadFile;
            chunkSize: number;
        }) => {
            //在前取1M的切片，在后取1M的切片
            const { file, chunkSize } = data;
            const rawFile = file.raw;
            //@ts-ignore
            const SparkMD5: SparkMD5 = self.SparkMD5;
            const spark = new SparkMD5() as typeof SparkMD5;
            //文件时间戳和文件大小
            spark.append(
                rawFile.lastModified.toString() +
                    file.total.toString(),
            );

            if (file.total > 1024 * 1024) {
                const firstChunk = rawFile.slice(
                    0,
                    1024 * 1024,
                );
                const lastChunk = rawFile.slice(
                    file.total - 1024 * 1024,
                    file.total,
                );
                const firstContent =
                    await firstChunk.text();
                spark.append(firstContent);
                const lastContent = await lastChunk.text();
                spark.append(lastContent);
                spark.append(firstChunk.text());
            } else {
                const content = await rawFile
                    .slice(0, file.total)
                    .text();
                spark.append(content);
            }

            const fileHash = spark.end() as string;
            let startPos = 0;
            const fileChunks: UploadChunk[] = [];
            let index = 0;
            while (startPos < file.total) {
                index++;
                const chunk = rawFile.slice(
                    startPos,
                    Math.min(
                        rawFile.size,
                        startPos + chunkSize,
                    ),
                );
                fileChunks.push({
                    raw: chunk,
                    filename: rawFile.name,
                    size: chunk.size,
                    index: index,
                    uid: file.uid + index,
                });
                startPos += chunkSize;
            }

            return {
                fileChunks,
                fileHash,
            };
        },
        {
            dependencies: [url],
            timeout,
        },
    );
    async function start() {
        return workerFn({
            file: file,
            chunkSize: chunkSize,
        });
    }
    function stop() {
        workerTerminate();
    }
    return {
        start,
        stop,
    };
}

export function useSliceFile(
    file: UploadFile,
    thread = 1,
    timeout = 5 * 60 * 1000,
    url = "https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M/spark-md5/3.0.2/spark-md5.min.js",
): UseSliceFileReturn {
    thread = Math.min(
        Math.max(thread, 1),
        getConcurrency(),
    );
    thread = Number.isInteger(thread)
        ? thread
        : Math.round(thread);
    if (file.total <= thread) {
        thread = 1;
    }
    const clearFns: ReturnType<
        typeof sliceFile
    >["workerTerminate"][] = [];
    const workerChunkCount = Math.ceil(file.total / thread);
    let chunkCount = -1;
    const promises: Promise<SliceReturn>[] = [];

    const { workerFn, workerTerminate } = useWebWorkerFn(
        (data: {
            chunks: SliceReturn[];
            //@ts-ignore
        }): {
            fileHash: string;
            fileChunks: UploadChunk[];
        } => {
            const { chunks } = data;
            //@ts-ignore
            const SparkMD5 = self.SparkMD5;
            const spark = new SparkMD5();
            const fileChunks: UploadChunk[] = [];
            for (const batchChunk of chunks) {
                for (const chunk of batchChunk.fileChunks) {
                    fileChunks.push(chunk);
                    spark.append(chunk.hash as string);
                }
            }
            const fileHash = spark.end();
            return {
                fileHash,
                fileChunks,
            };
        },
        {
            dependencies: [url],
            timeout,
        },
    );

    async function start(): Promise<SliceReturn> {
        for (let i = 1; i <= thread; i++) {
            const { workerFn, workerTerminate } = sliceFile(
                timeout,
                url,
            );
            workerTerminate();
            clearFns.push(workerTerminate);
            const start = chunkCount + 1,
                end = Math.min(
                    chunkCount + workerChunkCount,
                    file.total - 1,
                );
            if (start > end) {
                break;
            }
            const p = workerFn({
                fileUid: file.uid,
                file: file.raw as UploadRawFile,
                chunkSize: file.chunkSize,
                start,
                end,
            });
            p.finally(() => {
                workerTerminate();
            });
            promises.push(p);
            chunkCount += workerChunkCount;
        }
        try {
            const values = await Promise.all(promises);
            clearFns.length = 0;
            clearFns.push(workerTerminate);
            return await workerFn({ chunks: values });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    function stop() {
        clearFns.forEach((fn) => {
            fn.call(null);
        });
    }

    return {
        start,
        stop,
    };
}

export function useSingleSliceFile(
    file: UploadFile,
    timeout = 5 * 60 * 1000,
    url = "https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M/spark-md5/3.0.2/spark-md5.min.js",
): UseSliceFileReturn {
    const { workerFn, workerTerminate } = useWebWorkerFn<
        (data: {
            file: UploadRawFile;
            chunkSize: number;
        }) => Promise<SliceReturn>
    >(
        (data) => {
            return new Promise((resolve, reject) => {
                //在worker内定义getChunks函数，不然无法访问
                function getChunks(
                    file: UploadRawFile,
                    chunkSize: number,
                ) {
                    let startPos = 0;
                    const chunks: UploadChunk[] = [];
                    let index = 1;
                    while (true) {
                        const blob = file.slice(
                            startPos,
                            Math.min(
                                startPos + chunkSize,
                                file.size,
                            ),
                        );
                        chunks.push({
                            size: blob.size,
                            raw: blob,
                            filename: file.name,
                            uid: file.uid + index,
                            index,
                        });
                        startPos += chunkSize;
                        index++;
                        if (startPos >= file.size) {
                            break;
                        }
                    }
                    return chunks;
                }

                //@ts-ignore
                const SparkMD5 = self.SparkMD5;
                const { file, chunkSize } = data;
                const spark = new SparkMD5();

                spark.append(file.lastModified + file.size);
                const reader = new FileReader();
                reader.onerror = function (e) {
                    reject(e);
                };
                if (file.size < 1024 * 1024 * 2) {
                    //小于2M
                    reader.onload = function (e) {
                        const result = e.target
                            .result as string;
                        spark.append(result);
                        const fileHash =
                            spark.end() as string;
                        const fileChunks = getChunks(
                            file,
                            chunkSize,
                        );
                        resolve({
                            fileHash,
                            fileChunks,
                        });
                    };
                    reader.readAsText(file);
                } else {
                    let count = 0;
                    const firstChunk = file.slice(
                        0,
                        1024 * 1024,
                    );
                    const lastChunk = file.slice(
                        file.size - 1024 * 1024,
                        file.size,
                    );
                    //大于2M
                    reader.onload = function (e) {
                        count++;
                        const result = e.target
                            .result as string;
                        spark.append(result);
                        if (count === 2) {
                            const fileHash =
                                spark.end() as string;
                            const fileChunks = getChunks(
                                file,
                                chunkSize,
                            );
                            resolve({
                                fileHash,
                                fileChunks,
                            });
                        } else if (count === 1) {
                            reader.readAsText(lastChunk);
                        }
                    };
                    reader.readAsText(firstChunk);
                }
            });
        },
        {
            dependencies: [url],
            timeout,
        },
    );

    async function start() {
        return await workerFn({
            file: file.raw,
            chunkSize: file.chunkSize,
        });
    }

    function stop() {
        workerTerminate();
    }

    return {
        start,
        stop,
    };
}
