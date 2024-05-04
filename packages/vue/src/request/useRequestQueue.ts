import {RequestQueueOptions, UseRequestQueueReturn} from "./interface.ts";
import {RequestQueue} from "./RequestQueue.ts";

/**
 * 定义请求hook,用于瞬时取消所有的请求
 * @param option
 */
export function useRequestQueue(option:RequestQueueOptions={}):UseRequestQueueReturn{
    const queue = new RequestQueue(option)
    return {
        request:queue.request,
        cancel:queue.cancel
    }
}
