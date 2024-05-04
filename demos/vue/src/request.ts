import axios, {AxiosHeaders, AxiosProgressEvent} from 'axios'
interface UseRequestOptions {
    timeout?:number;
    headers?:AxiosHeaders,
    withCredentials?:boolean
}

interface GetOptions {
    method:'get';
    params?:Record<string, any>;
    timeout?:number
    onDownloadProgress?:(evt:AxiosProgressEvent)=>void
}

interface PostOptions {
    method:'post';
    data?:Record<string, any>|FormData;
    timeout?:number;
    onUploadProgress?:(evt:AxiosProgressEvent)=>void
    onDownloadProgress?:(evt:AxiosProgressEvent)=>void
}


export function useRequestQueue(option:UseRequestOptions={}){
    const {timeout=10000,withCredentials=false,headers} = option
    let source = axios.CancelToken.source()
    const defHttp = axios.create({
        timeout:timeout,
        withCredentials:withCredentials,
        headers:headers
    });
    defHttp.interceptors.request.use((config)=>{
        return config
    },(error)=>{
        console.log(error,'拦截器的错误输出');
        throw error
    })
    defHttp.interceptors.response.use((value)=>value,(error)=>{
        // console.log(error)
       console.log(axios.isCancel(error));
       if(axios.isCancel(error)){
           console.log('在这里重试请求')
       }
       console.log(error instanceof axios.CanceledError)
       console.log(error)
    })
    function request<T extends any =any>(url:string,options:PostOptions|GetOptions){
        return function (){
            switch (options.method){
                case "get":
                    return defHttp.get<T>(url,{
                        cancelToken:source.token,
                        params:options?.params ?? {},
                        timeout:options?.timeout ?? timeout,
                        onDownloadProgress(evt){
                            options?.onDownloadProgress?.(evt)
                        }
                    })
                case "post":
                    return defHttp.post<T>(url,options?.data ?? {},{
                        cancelToken:source.token,
                        timeout:options?.timeout ?? timeout,
                        onUploadProgress(evt){
                            options?.onUploadProgress?.(evt)
                        },
                        onDownloadProgress(evt){
                            options?.onUploadProgress?.(evt)
                        }
                    })
            }
        }
    }

    function cancel(message?:string){
        source.cancel(message);
        // source=axios.CancelToken.source()
    }

    return {
        request,
        cancel
    }
}