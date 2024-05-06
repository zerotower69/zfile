//*兼容requestIdleCallback
//*参考：https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback
const genId = (function () {
    let id = 0;
    return function () {
        return ++id;
    };
})();

const idMap: Map<number, number> = new Map<
    number,
    number
>();

type RequestIdleFn = (idleDeadline: IdleDeadline) => void;

/**
 *
 * @param  cb
 * @param  options
 * @return
 * @private
 */
const _requestIdleCallback = function (
    cb: RequestIdleFn,
    options = { timeout: 0 },
) {
    const channel = new MessageChannel();
    const port1 = channel.port1;
    const port2 = channel.port2;
    let deadlineTime: number; //超时时间
    let frameDeadlineTime: number; // 当前帧的截止时间
    let callback: RequestIdleFn;
    const id = genId();
    port2.onmessage = () => {
        const frameTimeRemaining = () =>
            frameDeadlineTime - performance.now(); // 获取当前帧剩余时间
        const didTimeout =
            performance.now() >= deadlineTime; // 是否超时

        if (didTimeout || frameTimeRemaining() > 0) {
            const idleDeadline = {
                timeRemaining: frameTimeRemaining,
                didTimeout,
            };
            callback && callback(idleDeadline);
        } else {
            const frameId = requestAnimationFrame(
                (timeStamp) => {
                    frameDeadlineTime = timeStamp + 16.7;
                    port1.postMessage(null);
                },
            );
            idMap.set(id, frameId);
        }
    };

    const frameId = window.requestAnimationFrame(
        (timeStamp) => {
            frameDeadlineTime = timeStamp + 16.7; // 当前帧截止时间，按照 60fps 计算
            deadlineTime = options?.timeout
                ? timeStamp + options.timeout
                : Infinity; // 超时时间
            callback = cb;
            port1.postMessage(null);
        },
    );

    idMap.set(id, frameId);

    return id;
};

/**
 *
 * @param {number} id
 * @private
 */
const _cancelIdleCallback = function (id: number) {
    if (!idMap.has(id)) return;
    window.cancelAnimationFrame(id);
    idMap.delete(id);
};
export const requestIdleCallback =
    window.requestIdleCallback || _requestIdleCallback;
export const cancelIdleCallback =
    window.cancelIdleCallback || _cancelIdleCallback;
