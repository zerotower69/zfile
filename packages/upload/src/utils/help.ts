let fileId = 1;
let chunkId = 2;

//获取用户可用线程数
export const getConcurrency = () =>
    navigator.hardwareConcurrency || 0;

//生成文件uid
export const genFileId = () => Date.now() + fileId++;

//生成切片uid
export const genChunkId = () => Date.now() + chunkId++;
