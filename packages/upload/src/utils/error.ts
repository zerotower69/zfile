import { isString } from "./is";

export class BigFileError extends Error {
    isCancel: boolean;
    constructor(m: string, isCancel = false) {
        super(m);
        this.name = "BigFileUploadError";
        this.isCancel = isCancel;
    }
}

export function throwError(
    scope: string,
    m: string,
): never {
    throw new BigFileError(`[${scope}] ${m}`);
}

export function debugWarn(err: Error): void;
export function debugWarn(
    scope: string,
    message: string,
): void;
export function debugWarn(
    scope: string | Error,
    message?: string,
): void {
    if (process.env.NODE_ENV !== "production") {
        const error: Error = isString(scope)
            ? new BigFileError(`[${scope}] ${message}`)
            : scope;
        // eslint-disable-next-line no-console
        console.warn(error);
    }
}

export function transformError(e?: any, prefix?: string) {
    if (e instanceof BigFileError) {
        return e;
    }
    let errorMsg = e?.message ?? e ?? "";
    if (prefix) {
        errorMsg = prefix + " " + errorMsg;
    }
    return new BigFileError(errorMsg);
}

export function getError(
    message: string,
    isCancel = false,
) {
    return new BigFileError(`${message}`, isCancel);
}

export function isCancel(e: any): e is BigFileError {
    return e instanceof BigFileError && e.isCancel;
}
