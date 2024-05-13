import humanFormat, {
    ScaleLike,
    Options,
} from "human-format";
import { transformError } from "./error";
import { isFunction } from "lodash-es";
import { UploadFile } from "../interface";

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

/**
 * 外部使用human-format
 * @param size
 * @param opts
 */
export function formatSize(
    size: number,
    opts?: Options<ScaleLike>,
) {
    return humanFormat(size, opts);
}

/**
 *异步apply
 * @param condition
 * @param fn
 * @param args
 * @param delay
 */
export const asyncApply: <
    F extends (...args: any[]) => any,
>(
    fn: F | undefined,
    args: Parameters<F>,
    condition?: boolean,
    delay?: number,
) => void = (fn, args, condition = true, delay = 0) => {
    if (condition && isFunction(fn)) {
        try {
            setTimeout(() => {
                fn.apply(null, args);
            }, delay);
        } catch (err) {
            throw transformError(err);
        }
    }
};

/**
 *同步apply
 * @param fn
 * @param args
 * @param condition
 */
export const syncApply: <F extends (...args: any[]) => any>(
    fn: F | undefined,
    args: Parameters<F>,
    condition?: boolean,
    delay?: number,
) => void = (fn, args, condition = true) => {
    if (condition && isFunction(fn)) {
        try {
            fn.apply(null, args);
        } catch (err) {
            throw transformError(err);
        }
    }
};

/**
 * 计算总百分比
 * @param files
 * @param precision
 */
export function getAllPercentage(
    files: UploadFile[],
    precision = 0,
) {
    if (!files.length) {
        return 0;
    }
    const allUploaded = files.reduce(
        (acc, cur) => acc + cur.uploaded,
        0,
    );
    const allSize = files.reduce(
        (acc, cur) => acc + cur.size,
        0,
    );
    const percentage =
        (Math.min(allUploaded, allSize) / allSize) * 100;
    return precision > 0
        ? parseFloat(percentage.toFixed(precision))
        : Math.round(percentage);
}
