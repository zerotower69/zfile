import {
    UploadChunk,
    UploadFile,
    UploadRawFile,
} from "./interface";
import SparkMD5 from "spark-md5";
import { getConcurrency } from "./utils";
import { useWebWorkerFn, WebWorkerStatus } from "./worker";

interface SliceReturn {
    fileHash: string;
    fileChunks: UploadChunk[];
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
    console.log(SPARK_MD5_URL);
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
                const blobSlice = File.prototype.slice,
                    spark = new SparkMD5.ArrayBuffer(),
                    fileChunks: UploadChunk[] = [],
                    fileReader = new FileReader();
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
 * @param maxThread 最大线程数
 */
export function multipleSliceFile(
    file: UploadFile,
    maxThread = 6,
) {
    let thread = Math.min(getConcurrency(), maxThread);
    if (file.total <= thread) {
        thread = 1;
    }
    //every thread need to splice total chunks
    const workerChunkCount = Math.ceil(file.total / thread);
    let chunkCount = -1;
    const workFns: (() => Promise<SliceReturn>)[] = [];
    const terminateFns: ReturnType<
        typeof sliceFile
    >["workerTerminate"][] = [];
    const promises: Promise<SliceReturn>[] = [];
    for (let i = 0; i < thread; i++) {
        const { workerFn, workerTerminate } = sliceFile();
        const start = chunkCount + 1;
        const end = Math.min(
            chunkCount + workerChunkCount,
            file.total - 1,
        );
        if (start > end) {
            break;
        }
        const fn = () => {
            const p = workerFn({
                fileUid: file.uid,
                file: file.raw as UploadRawFile,
                chunkSize: file.chunkSize,
                start,
                end,
            });
            promises.push(p);
            p.finally(() => {
                workerTerminate();
            });
            return p;
        };
        workFns.push(fn);
        terminateFns.push(workerTerminate);
        chunkCount += workerChunkCount;
    }
    function start() {
        while (workFns.length) {
            const fn = workFns.shift();
            fn!();
        }
        return Promise.all(promises).then((values) => {
            //strategy: all the hash of chunks sort, then get new hash
            const spark = new SparkMD5();
            const fileChunks: UploadChunk[] = [];
            for (const batchChunk of values) {
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
        });
    }
    function stop(status?: WebWorkerStatus) {
        while (terminateFns.length) {
            const terminateFn = terminateFns.shift()!;
            terminateFn(status);
        }
    }
    return {
        start,
        stop,
    };
}

export interface UseSliceFileReturn {
    start: () => Promise<SliceReturn>;
    stop: () => void;
}

export function useSliceFile(
    file: UploadFile,
    thread = 1,
    timeout = 5 * 60 * 1000,
    url?: string,
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
        return Promise.all(promises).then((values) => {
            //strategy: all the hash of chunks sort, then get new hash
            const spark = new SparkMD5();
            const fileChunks: UploadChunk[] = [];
            for (const batchChunk of values) {
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
        });
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

//TODO:如果不支持worker的情况下，就要兼容在主线程里分片和计算hash，这时为了防止UI卡顿，可以选择使用requestIdleCallback来完成切片
