<template>
  <drag-ball />
  <upload-modal @upload="handleUpload" :files="fileList" />
</template>
<script setup lang="ts">
import { ref, unref } from 'vue'
import DragBall from '@/components/UploadList/DragBall.vue'
import { useFileUpload } from '@zfile/upload'
import type { UploadFile } from '@zfile/upload/dist/interface'

const fileList = ref<UploadFile[]>([])

const { upload } = useFileUpload({
  actions: {
    baseURL: 'http://localhost:3000',
    check: {
      action: '/check',
      method: 'post',
      transformData(file) {
        return {
          fileHash: file.hash
        }
      }
    },
    upload: {
      action: '/upload',
      method: 'post',
      transformData(chunk, file) {
        const formData = new FormData()
        formData.append('total', `${file.total}`)
        formData.append('chunkNumber', `${chunk.index}`)
        formData.append('chunkSize', `${chunk.size}`)
        formData.append('fileName', `${file.name}`)
        formData.append('fileSize', `${file.size}`)
        formData.append('fileHash', `${file.hash}`)
        formData.append('chunkHash', `${chunk.hash}`)
        return formData
      }
    },
    merge: {
      action: '/merge',
      method: 'post',
      transformData(file, chunks) {
        return {
          total: file.total,
          md5: file.hash,
          fileName: file.name
        }
      }
    }
  },
  onFileChange(file, files, type) {
    fileList.value = [...files]
  },
  onProgress(percentage, file, event) {
    updateFile(file)
  },
  onSuccess(file) {
    updateFile(file)
  },
  onSliceEnd(file, files) {
    console.log('切片成功')
  },
  onSliceError(error, file, files) {
    console.error('切片失败', error)
  }
})

function updateFile(file: UploadFile) {
  const list = unref(fileList)
  const index = list.findIndex((item) => (item.uid = file.uid))
  if (index > -1) {
    list[index] = file
    fileList.value = [...list]
  }
}

function handleUpload(files: File[]) {
  files.forEach((file) => {
    upload(file)
  })
}
</script>

<style scoped lang="less"></style>
