let fileId = 1;
let chunkId = 2;

//get the number of thread
export const getConcurrency = () => navigator.hardwareConcurrency || 0;

export const genFileId = () => Date.now() + fileId++;
export const genChunkId = () => Date.now() + chunkId++;

export const isFunction = (val: unknown): val is Function => typeof val === "function";

export const isArray = (val: any): val is any[] => Array.isArray(val);

class BigFileError extends Error {
    constructor(m: string) {
        super(m);
        this.name = "BigFileError";
    }
}

export function throwError(m: string): never {
    throw new BigFileError(`[BigUpload] ${m}`);
}
export function transformError(e?: any, prefix?: string) {
    return new BigFileError(`[BigUpload] ${prefix} ${e?.message ?? e ?? ""}`);
}

export function getError(message: string) {
    return new BigFileError(`[BigUpload] ${message}`);
}
