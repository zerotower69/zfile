import humanFormat from "human-format";

let fileId = 1;
let chunkId = 2;

//获取用户可用线程数
export const getConcurrency = () =>
    navigator.hardwareConcurrency || 0;

//生成文件uid
export const genFileId = () => Date.now() + fileId++;

//生成切片uid
export const genChunkId = () => Date.now() + chunkId++;

/**
 * 处理url
 * @param url
 * @param baseURL
 */
export const normalizeUrl = (
    url: string,
    baseURL?: string,
) => {
    if (!baseURL || /^http(s)*/.test(url)) return url;
    return baseURL + url;
};

export function formatSize(size: number) {
    return humanFormat(size);
}

declare type AsyncApply<F extends (...args: any[]) => any> =
    (
        fn: F,
        args: Parameters<F>,
        delay?: number,
    ) => Promise<ReturnType<F>>;

export const asyncApply: <
    F extends (...args: any[]) => any,
>(
    fn: F | undefined,
    args: Parameters<F>,
    delay?: number,
) => Promise<ReturnType<F>> = (fn, args, delay = 0) => {
    return new Promise((resolve, reject) => {
        try {
            setTimeout(() => {
                const res = fn.apply(this, args);
                resolve(res);
            }, delay);
        } catch (err) {
            reject(err);
        }
    });
};
