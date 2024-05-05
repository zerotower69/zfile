export const isClient =
    typeof window !== "undefined" &&
    typeof document !== "undefined";
export const isWorker =
    typeof WorkerGlobalScope !== "undefined" &&
    globalThis instanceof WorkerGlobalScope;
