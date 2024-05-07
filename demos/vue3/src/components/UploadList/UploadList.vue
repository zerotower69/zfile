<template>
  <div class="z-upload-list-box bg-white text-black px-4 py-6">
    <div class="z-upload-list-header flex flex-col mb-4">
      <div class="z-upload-list-top-button-group flex">
        <vxe-button>全部暂停</vxe-button>
        <vxe-button>全部开始</vxe-button>
        <vxe-button>全部删除</vxe-button>
      </div>
    </div>
    <div class="z-upload-list-table">
      <vxe-table :data="fileList">
        <vxe-column title="文件名" min-width="300"></vxe-column>
        <vxe-column title="大小" width="100"></vxe-column>
        <vxe-column title="状态" width="150"></vxe-column>
        <vxe-column title="操作" min-width="150"></vxe-column>
        <template #empty>
          <div>暂无文件</div>
        </template>
      </vxe-table>
    </div>
    <input type="file" class="hidden" ref="inputRef" />
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { UploadFile } from '@zfile/upload/dist/interface'
const fileList = ref<UploadFile[]>([])
</script>

<style lang="less" scoped></style>
