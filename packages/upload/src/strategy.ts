import { AxiosResponse } from "axios";
import {
    CheckApiReturn,
    MergeApiReturn,
    UploadApiReturn,
    UploadChunk,
} from "./interface";

export const checkTransformResponse: (
    response: AxiosResponse,
    chunks: UploadChunk[],
) => Awaited<CheckApiReturn> = (
    response: AxiosResponse,
    chunks: UploadChunk[],
) => {
    const data = response.data;
    if (data.success) {
        return {
            success: true,
            response,
        };
    }
    const list: { hash: string; index: number }[] =
        data.data?.map((item: Record<string, any>) => ({
            hash: item.chunk_hash,
            index: item.chunk_number,
        })) ?? [];
    list.sort((pre, cur) => pre.index - cur.index);
    const indexSet = new Set<number>();
    const hashSet = new Set<string>();

    for (let i = 0; i < list.length; i++) {
        indexSet.add(list[i].index);
        hashSet.add(list[i].hash);
    }
    const leftChunks = chunks.filter((chunk) => {
        return !(
            indexSet.has(chunk.index) &&
            hashSet.has(chunk.hash as string)
        );
    });
    const uploadedChunks = chunks.filter((chunk) => {
        return (
            indexSet.has(chunk.index) &&
            hashSet.has(chunk.hash as string)
        );
    });
    const check = !leftChunks.length;
    return {
        success: check,
        response,
        chunks: leftChunks,
        uploadedChunks,
    };
};

export const checkTransformError = (
    error: any,
    isCancel: boolean,
): Awaited<CheckApiReturn> => {
    return {
        success: false,
        error,
        isCancel,
    };
};

export const uploadTransformResponse = (
    response: AxiosResponse,
): Awaited<UploadApiReturn> => {
    return {
        success: true,
        response,
    };
};

export const uploadTransformError = (
    error: any,
    isCancel: boolean,
): Awaited<UploadApiReturn> => {
    return {
        success: false,
        error,
        isCancel,
    };
};

export const mergeTransformResponse = (
    response: AxiosResponse,
): Awaited<MergeApiReturn> => {
    return {
        success: true,
        response,
    };
};

export const mergeTransformError = (
    error: any,
    isCancel: boolean,
): Awaited<MergeApiReturn> => {
    return {
        success: false,
        error,
        isCancel,
    };
};
