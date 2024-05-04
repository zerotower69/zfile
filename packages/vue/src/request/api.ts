import {UploadChunk, UploadFile} from "../interface.ts";
import {
    UploadActions,
    CheckApi,
    UploadApi,
    UploadActionProgress, MergeApi
} from "./interface.ts";
import {AxiosResponse} from "axios";
import {FileTask} from "../task/FileTask.ts";

export function getCheckChunkApi(
    action:UploadActions['check'],
    task:FileTask
):CheckApi{
    const defaultStrategy=(response:AxiosResponse, chunks:UploadChunk[])=>{
        const data = response.data;
        if(data.success){
            return []
        }
        const list:{hash:string;index:number}[] = data.data?.map((item:Record<string, any>)=>({
            hash:item.chunk_hash,
            index:item.chunk_number
        }))?? [];
        list.sort((pre,cur)=>pre.index-cur.index);
        const indexSet = new Set<number>();
        const hashSet = new Set<string>();

        for(let i=0;i<list.length;i++){
            indexSet.add(list[i].index);
            hashSet.add(list[i].hash)
        }
        return chunks.filter((chunk)=>{
            return !(indexSet.has(chunk.index) && hashSet.has(chunk.hash as string))
        })
    }
    const {
        action:url,
        method,
        timeout,
        transformPrams,
        transformData,
        strategy,
        } = action
    //normalize action
    return async (file:UploadFile, chunks?:UploadChunk[])=>{
        const params = transformPrams?.call(null,file);
        const data = transformData?.call(null,file);
        return task.requestQueue.add(task,task.request({
            url:url,
            method:method,
            timeout:timeout,
            params:params,
            data:data
        })).then((resp)=>{
            //@ts-ignore
            return strategy?.(resp,file,chunks!)??defaultStrategy(resp,chunks!)
        })
    }
}

let uploadId =1;

export function getUploadChunkApi<D extends any =any>(
    action:UploadActions['upload'],
    task:FileTask
):UploadApi<D>{
    const {
        action:url,
        method,
        file:fileField='file',
        timeout,
        transformData,
        transformParams
    } = action
    return async function(chunk:UploadChunk, file?:UploadFile, onProgress?:UploadActionProgress){
        const data = transformData?.call(null,chunk,file) ?? new FormData();
        if(!data.has(fileField)){
            data.append(fileField,chunk.raw)
        }
        const params =transformParams?.call(null,chunk,file);
        return task.requestQueue.add(task,task.request({
            url:url,
            method:method,
            timeout:timeout,
            data:data,
            params:{
                ...(params?? {}),
                t:Date.now()+uploadId++
            },
            onUploadProgress(evt) {
                onProgress?.(evt.progress as number,chunk,evt);
                action?.onProgress?.(evt.progress as number,chunk,evt)
            },
        }))
    }
}

export function getMergeChunkApi(
    action:UploadActions['merge'],
    task:FileTask
):MergeApi{
    const {
        action:url,
        method,
        timeout,
        transformPrams,
        transformData
    } = action
    return async function(file, chunks){
        const params = transformPrams?.call(null,file,chunks);
        const data = transformData?.call(null,file,chunks);
        return task.requestQueue.add(task,task.request({
            url:url,
            method:method,
            timeout:timeout,
            params:params,
            data:data,
        })).then(()=>true,()=>false)
    }
}
type RetryFn<T extends any=any> =()=>Promise<T>
export async function retryAsyncFn<T extends any=any>(fn:RetryFn<T>,retries:number){
    let retriesCount=0;
    return new Promise<T>((resolve,reject)=>{
        async function recurveFn(){
            while (true){
                retriesCount++
                try{
                    const res = await fn();
                    resolve(res)
                    break
                } catch (err){
                    if(retriesCount===retries){
                        reject(err)
                        break
                    }
                }
            }
        }
        recurveFn()
    });
}