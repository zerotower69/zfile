import {RequestQueueOptions} from "./interface.ts";
import axios, {AxiosInstance, AxiosRequestConfig, CancelTokenSource} from "axios";

export class RequestQueue{
    options:RequestQueueOptions;
    source:CancelTokenSource
    _defHttp:AxiosInstance
    constructor(options:RequestQueueOptions) {
        const {
            timeout=10000,
            withCredentials=false,
            headers
        } = options
        this.options=options;
        this.source = axios.CancelToken.source();
        this._defHttp =axios.create({
            timeout:timeout,
            withCredentials:withCredentials,
            headers:headers
        });
    }
    cancel(message?:string){
        this.source.cancel(message);
        this.source=axios.CancelToken.source()
    }
    request<T extends any = any>(config:AxiosRequestConfig){
        // config.cancelToken=this.source.token;
        const that = this;
        return function (){
            console.log(config,that._defHttp.defaults)
            return that._defHttp.request<T>(config)
        }
    }
}