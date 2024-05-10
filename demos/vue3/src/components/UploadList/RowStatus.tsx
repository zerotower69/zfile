import { computed, defineComponent, type PropType } from 'vue'
import { UploadStatus } from '@zfile/upload'
import type { UploadFile } from '@zfile/upload/dist/interface'
import Progress from './Progress.vue'

export default defineComponent({
  name: 'RowStatus',
  props: {
    row: {
      type: Object as PropType<UploadFile>
    }
  },
  setup(props) {
    const getPercentage = computed(() => {
      const percent = props.row?.percentage ?? 0
      if (percent >= 1) {
        return 100
      } else {
        return Math.round(percent * 100)
      }
    })
    const status = computed(() => props.row!.status)
    function getRate() {
      return props.row?.task?.rate ?? ''
    }
    const leftTime = computed(() => props.row?.task?.leftTime ?? 0)
    function getStatus(status: UploadStatus) {
      switch (status) {
        case UploadStatus.WAITING:
          return <div class="text-blue">等待中</div>
        case UploadStatus.READING:
          return <div class="text-blue">读取中...</div>
        case UploadStatus.READY:
          return <div class="text-blue">准备上传...</div>
        case UploadStatus.FAILED:
        case UploadStatus.CANCEL:
        case UploadStatus.PENDING:
          return <div class="text-red">已暂停</div>
        case UploadStatus.OFFLINE:
          return <div class="text-red">网络中断</div>
        case UploadStatus.UPLOADING:
          return (
            <div class="flex gap-2">
              <div class="text-blue">{getRate()}</div>
              <div class="text-gray">{leftTime.value}</div>
            </div>
          )
        case UploadStatus.SUCCESS:
          return <div class="text-green">已完成</div>
        default:
          return <div></div>
      }
    }
    return {
      getPercentage,
      status,
      getStatus
    }
  },
  render() {
    return (
      <div class="row-status flex flex-col">
        <Progress percent={this.getPercentage}></Progress>
        {this.getStatus(this.status)}
      </div>
    )
  }
})
