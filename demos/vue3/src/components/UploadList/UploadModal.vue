<template>
  <div class="z-upload-modal bg-white text-black px-4 py-6">
    <div class="z-upload-list-header flex flex-col mb-4">
      <div class="z-upload-list-top-button-group flex justify-between">
        <div class="flex gap-4">
          <vxe-button>全部暂停</vxe-button>
          <vxe-button>全部开始</vxe-button>
          <vxe-button>全部删除</vxe-button>
        </div>
        <div>
          <vxe-button status="primary" @click="handleUpload">上传文件</vxe-button>
        </div>
      </div>
    </div>
    <div class="z-upload-list-table">
      <vxe-table :data="props.files">
        <vxe-column title="文件名" field="name" min-width="300"></vxe-column>
        <vxe-column title="大小" field="size" width="100"></vxe-column>
        <vxe-column title="状态" width="150">
          <template #default="{ row }">
            <Progress :percent="getPercentage(row)" />
          </template>
        </vxe-column>
        <vxe-column title="操作" min-width="150">
          <template #default="{ row }">
            <div class="flex gap-4">
              <div class="inline-block text-[20px] text-orange i-custom-pause"></div>
            </div>
          </template>
        </vxe-column>
        <template #empty>
          <div>暂无文件</div>
        </template>
      </vxe-table>
    </div>
    <input type="file" class="hidden" ref="inputRef" @change.self="handleFileChange" />
  </div>
</template>
<script setup lang="ts">
import { type PropType, ref } from 'vue'
import type { UploadFile } from '@zfile/upload/dist/interface'

const props = defineProps({
  files: {
    type: Array as PropType<UploadFile[]>,
    default: () => []
  }
})

const inputRef = ref<HTMLInputElement | null>(null)
const emits = defineEmits(['upload'])

function handleUpload() {
  inputRef.value?.click()
}
function handleFileChange(evt: Event) {
  const fileList = (evt.target as HTMLInputElement).files!
  if (!fileList.length) return
  const files = [...fileList]
  emits('upload', files)
}

function getPercentage(row: UploadFile) {
  console.log(row.percentage)
  return (row.percentage || 0) * 100
}
</script>

<style lang="less" scoped></style>
