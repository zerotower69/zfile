<template>
  <drag-ball />
  <upload-modal @upload="handleUpload" :files="fileList" />
</template>
<script setup lang="ts">
import { ref } from 'vue'
import DragBall from '@/components/UploadList/DragBall.vue'
import { useFileUpload } from '@zfile/upload'
import type { UploadFile } from '@zfile/upload/dist/interface'

const fileList = ref<UploadFile[]>([])

const { upload } = useFileUpload({
  actions: {
    baseURL: 'http://localhost:3000',
    check: {
      action: '/check',
      method: 'post'
    },
    upload: {
      action: '/upload',
      method: 'post'
    },
    merge: {
      action: '/merge',
      method: 'post'
    }
  },
  chunkSize: 1024 * 1024,
  onFileChange(file, files, type) {
    fileList.value = [...files]
  }
})

function handleUpload(files: File[]) {
  files.forEach((file) => {
    upload(file)
  })
}
</script>

<style scoped lang="less"></style>
