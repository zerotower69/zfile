<script setup lang="ts">
import {onMounted, ref} from "vue"
import {useBigUpload} from "@zfile/vue-bigupload"
const uploadRef=ref<HTMLInputElement>();

const {upload} =useBigUpload({
  multiple:true,
  accept:"",
  actions:{
    upload:{
      action:"http://localhost:3000/upload",
      method:'post',
      transformData(chunk, file) {
          const formData = new FormData();
          formData.append('total',`${file?.total}`);
          formData.append('chunkNumber',`${chunk?.index}`);
          formData.append('chunkSize',`${chunk?.size}`);
          formData.append('chunkHash',`${chunk?.hash}`);
          formData.append('fileName',`${file?.name}`);
          formData.append('fileSize',`${file?.size}`);
          formData.append('fileHash',`${file?.hash}`)
        return formData
      },
      timeout:99999
    },
    check:{
      action:"http://localhost:3000/check",
      method:'post',
      transformData(file) {
          return {
            fileHash:file.hash
          }
      },
    },
    merge:{
      action:"http://localhost:3000/merge",
      method:'post',
      timeout:60*1000,
      transformData(file) {
          return{
            total:file.total,
            md5:file.hash,
            fileName:file.name
          }
      },
    }
  }
});

onMounted(()=>{
  uploadRef.value!.onchange=function (ev:Event){
    const fileList = (ev.target as HTMLInputElement).files!;
    if(fileList.length){
      upload(...fileList)
    }
  }
})


</script>

<template>
  <div>
    <input ref="uploadRef" type="file" multiple="true" />
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
