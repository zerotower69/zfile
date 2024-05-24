<template>
  <drag-ball :percentage="allPercentage" />
  <upload-modal @upload="handleUpload" :files="fileList" />
</template>
<script setup lang="ts">
import { nextTick, ref, toRaw, unref } from 'vue'
import DragBall from '@/components/UploadList/DragBall.vue'
import {
  useFileUpload,
  getAllPercentage,
  checkTransformResponse,
  checkTransformError,
  uploadTransformResponse,
  uploadTransformError,
  mergeTransformResponse,
  mergeTransformError
} from '@zfile/upload'
import type { UploadFile } from '@zfile/upload/dist/interface'
import { modal } from 'vxe-table'

const fileList = ref<UploadFile[]>([])
const allPercentage = ref(0)

const { upload } = useFileUpload({
  chunkSize: 1024 * 1024 * 5,
  worker: {
    // spark_md5_url: new URL('./lib/spark-md5.min.js', window.location.href).href,
    // thread: 4
  },
  actions: {
    baseURL: import.meta.env.VITE_REQUEST_URL,
    check: {
      action: '/check',
      method: 'post',
      transformData(file) {
        return {
          fileHash: file.hash
        }
      },
      transformResponse(response, chunks, file) {
        const data = response.data
        if (data.success) {
          return {
            success: true,
            response
          }
        }
        const list: { hash: string; index: number }[] =
          data.data?.map((item: Record<string, any>) => ({
            hash: item.chunk_hash,
            index: item.chunk_number
          })) ?? []
        list.sort((pre, cur) => pre.index - cur.index)
        const indexSet = new Set<number>()
        const hashSet = new Set<string>()

        for (let i = 0; i < list.length; i++) {
          indexSet.add(list[i].index)
          hashSet.add(list[i].hash)
        }
        const leftChunks = chunks.filter((chunk) => {
          return !(indexSet.has(chunk.index) && hashSet.has(chunk.hash as string))
        })
        const uploadedChunks = chunks.filter((chunk) => {
          return indexSet.has(chunk.index) && hashSet.has(chunk.hash as string)
        })
        const check = !leftChunks.length
        return {
          success: check,
          response,
          chunks: leftChunks,
          uploadedChunks
        }
      },
      transformError(error, isCancel) {
        return {
          success: false,
          error,
          isCancel
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
      },
      transformResponse: uploadTransformResponse,
      transformError: uploadTransformError
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
      },
      transformResponse: mergeTransformResponse,
      transformError: mergeTransformError
    }
  },
  onFileChange(file, files, type) {
    console.log(file, files, type)
    if (type === 'add') {
      fileList.value.push(file)
    } else {
      removeFile(file)
    }
    allPercentage.value = getAllPercentage(files)
  },
  onProgress(percentage, file, files) {
    updateFile(file)
    allPercentage.value = getAllPercentage(files)
  },
  onSuccess(file) {
    updateFile(file)
    nextTick(() => {
      //@ts-ignore
      allPercentage.value = getAllPercentage(fileList.value)
    })
    modal.message(`[${file.name}]上传成功`, {
      status: 'success'
    })
  },
  onSliceEnd(file, files) {
    updateFile(file)
    modal.message(`[${file.name}]切片成功`, {
      status: 'success'
    })
  },
  onStatusChange(status, oldStatus, file) {
    updateFile(file)
  },
  onSliceError(error, file, files) {
    updateFile(file)
    modal.message(`[${file.name}]切片失败`, {
      status: 'error'
    })
  },
  onUploadError(error, file, files) {
    updateFile(file)
    modal.message(`[${file.name}]${error.message}`, {
      status: 'error'
    })
  },
  onCancel(message, file, files) {
    updateFile(file)
    console.log(file.task?.uploadQueue)
    modal.message(`[${file.name}]，取消原因:${message}`, {
      status: 'info'
    })
  }
})

function updateFile(file: UploadFile) {
  const list = toRaw(unref(fileList))
  const index = list.findIndex((item) => item.uid === file.uid)
  if (index > -1) {
    list[index] = { ...file }
    fileList.value = [...list]
  }
}

function removeFile(file: UploadFile) {
  const list = unref(fileList)
  const index = list.findIndex((item) => item.uid === file.uid)
  if (index > -1) {
    fileList.value.splice(index, 1)
    file.task!.destroy()
  }
}

function handleUpload(files: File[]) {
  files.forEach((file) => {
    upload(file)
  })
}
</script>

<style scoped lang="less"></style>
