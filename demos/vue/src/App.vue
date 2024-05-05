<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useFileUpload } from "@zfile/upload";
const uploadRef = ref<HTMLInputElement>();

const { upload } = useFileUpload({
  actions: {
    upload: {
      action: "http://localhost:3000/upload",
      method: "post",
      transformData(chunk, file) {
        const formData = new FormData();
        formData.append("total", `${file?.total}`);
        formData.append("chunkNumber", `${chunk?.index}`);
        formData.append("chunkSize", `${chunk?.size}`);
        formData.append("chunkHash", `${chunk?.hash}`);
        formData.append("fileName", `${file?.name}`);
        formData.append("fileSize", `${file?.size}`);
        formData.append("fileHash", `${file?.hash}`);
        return formData;
      },
      timeout: 99999,
    },
    check: {
      action: "http://localhost:3000/check",
      method: "post",
      transformData(file) {
        return {
          fileHash: file.hash,
        };
      },
    },
    merge: {
      action: "http://localhost:3000/merge",
      method: "post",
      timeout: 60 * 1000,
      transformData(file) {
        return {
          total: file.total,
          md5: file.hash,
          fileName: file.name,
        };
      },
    },
  },
  onProgress(progress, file, context) {
    console.log(file?.name, progress);
  },
});

onMounted(() => {
  uploadRef.value!.onchange = function (ev: Event) {
    const fileList = (ev.target as HTMLInputElement).files!;
    if (fileList.length) {
      [...fileList].forEach((file) => {
        upload(file).then(() => {
          console.log("上传成功");
        });
      });
    }
  };
});
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
