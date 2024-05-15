import jobRunner from "./jobRunner";
import depsParser from "./depsParser";

/**
 * Converts the "fn" function into the syntax needed to be executed within a web worker
 *
 * @param fn the function to run with web worker
 * @param deps array of strings, imported into the worker through "importScripts"
 *
 * @returns a blob url, containing the code of "fn" as a string
 *
 * @example
 * createWorkerBlobUrl((a,b) => a+b, [])
 * // return "onmessage=return Promise.resolve((a,b) => a + b)
 * .then(postMessage(['SUCCESS', result]))
 * .catch(postMessage(['ERROR', error])"
 */
function createWorkerBlobUrl(fn: Function, deps: string[]) {
    const blobCode = `${depsParser(deps)};\n onmessage=(${jobRunner})(${fn})`;
    const blob = new Blob([blobCode], {
        type: "text/javascript",
    });
    return URL.createObjectURL(blob);
}

export default createWorkerBlobUrl;
