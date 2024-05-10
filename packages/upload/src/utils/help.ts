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
