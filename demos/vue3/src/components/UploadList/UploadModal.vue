<template>
  <div class="z-upload-modal bg-white text-black px-4 py-6">
    <div class="z-upload-list-header flex flex-col mb-4">
      <div class="z-upload-list-top-button-group flex justify-between">
        <div class="flex gap-4">
          <vxe-button class="operate-button">
            <div class="f-c-c gap-2">
              <span class="inline-block cursor-pointer text-[18px] i-custom:pause"></span>
              <span>全部暂停</span>
            </div>
          </vxe-button>
          <vxe-button class="operate-button">
            <div class="f-c-c gap-2">
              <span class="inline-block cursor-pointer text-[18px] i-custom:run"></span>
              <span>全部开始</span>
            </div>
          </vxe-button>
          <vxe-button class="operate-button"
            ><div class="f-c-c gap-2">
              <span class="inline-block cursor-pointer text-[18px] i-custom:delete"></span>
              <span>全部删除</span>
            </div></vxe-button
          >
        </div>
        <div>
          <vxe-button status="primary" @click="handleUpload">上传文件</vxe-button>
        </div>
      </div>
    </div>
    <div class="z-upload-list-table">
      <vxe-table :data="props.files">
        <vxe-column title="文件名" field="name" min-width="300"></vxe-column>
        <vxe-column title="大小" field="humanSize" width="180">
          <template #default="{ row }">
            {{ getSize(row) }}
          </template>
        </vxe-column>
        <vxe-column title="状态" width="220" align="center">
          <template #default="{ row }">
            <RowStatus :row="row" />
          </template>
        </vxe-column>
        <vxe-column title="操作" min-width="150">
          <template #default="{ row }">
            <div class="flex gap-4">
              <div
                v-if="rowPauseVisible(row)"
                @click="handleRowPause(row)"
                class="inline-block cursor-pointer text-[20px] text-gray hover:text-gray-5 i-custom:pause"
              ></div>
              <div
                v-if="rowRunVisible(row)"
                @click="handleRowRun(row)"
                class="inline-block cursor-pointer text-[20px] text-gray hover:text-gray-5 i-custom:run"
              ></div>
              <div
                class="inline-block cursor-pointer text-[20px] text-gray hover:text-gray-5 i-custom:delete"
                @click="handleRowDelete(row)"
              ></div>
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
import { formatSize } from '@zfile/upload'
import { VXETable, modal } from 'vxe-table'
import RowStatus from '@/components/UploadList/RowStatus'

const props = defineProps({
  files: {
    type: Array as PropType<UploadFile[]>,
    default: () => []
  }
})

const inputRef = ref<HTMLInputElement | null>(null)
const emits = defineEmits(['upload', 'delete-row'])

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
  return (row.percentage || 0) * 100
}
function rowPauseVisible(row: UploadFile) {
  return row.status !== 'success' && row.task!.running
}

function rowRunVisible(row: UploadFile) {
  return row.status !== 'success' && !row.task!.running
}

function getSize(row: UploadFile) {
  return `${formatSize(row.uploaded)}/${formatSize(row.size)}`
}

async function handleRowDelete(row: UploadFile) {
  const type = await modal.confirm('确认删除吗？')
  emits('delete-row', row)
  row.task!.destroy()
}
function handleRowRun(row: UploadFile) {
  row.task!.start()
}

function handleRowPause(row: UploadFile) {
  row.task!.stop('用户暂停')
}
</script>

<style lang="less" scoped>
.operate-button {
  color: black !important;
  &:hover {
    color: gray !important;
  }
}
</style>
