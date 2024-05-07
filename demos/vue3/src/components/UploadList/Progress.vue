<template>
  <div
    class="z-progress-line"
    :style="`width: ${totalWidth}; height: ${strokeWidth < 24 ? 24 : strokeWidth}px;`"
  >
    <div class="z-progress-inner">
      <div
        :class="['z-progress-bg', { 'z-success-bg': percent >= 100 }]"
        :style="`background: ${lineColor}; width: ${percent >= 100 ? 100 : percent}%; height: ${strokeWidth}px;`"
      ></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
interface Gradient {
  '0%'?: string
  '100%'?: string
  from?: string
  to?: string
  direction?: 'right' | 'left'
}
interface Props {
  width?: number | string // 进度条总宽度
  percent?: number // 当前进度百分比
  strokeColor?: string | Gradient // 进度条的色彩，传入 string 时为纯色，传入 object 时为渐变
  strokeWidth?: number // 进度条线的宽度，单位px
  showInfo?: boolean // 是否显示进度数值或状态图标
  format?: Function // 内容的模板函数 function | slot
}
const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  percent: 0,
  strokeColor: '#1677FF',
  strokeWidth: 8,
  showInfo: true,
  format: (percent: number) => percent + '%'
})
const totalWidth = computed(() => {
  // 进度条总宽度
  if (typeof props.width === 'number') {
    return props.width + 'px'
  } else {
    return props.width
  }
})

const lineColor = computed(() => {
  if (typeof props.strokeColor === 'string') {
    return props.strokeColor
  } else {
    return `linear-gradient(to ${props.strokeColor.direction || 'right'}, ${props.strokeColor['0%'] || props.strokeColor.from}, ${props.strokeColor['100%'] || props.strokeColor.to})`
  }
})
const showPercent = computed(() => {
  return props.format(props.percent > 100 ? 100 : props.percent)
})
</script>

<style lang="less" scoped>
@success: #52c41a;
.z-progress-line {
  display: flex;
  align-items: center;
  .z-progress-inner {
    width: 100%;
    background: #f5f5f5;
    border-radius: 100px;
    .z-progress-bg {
      position: relative;
      background-color: transparent;
      border-radius: 100px;
      transition: all 0.3s cubic-bezier(0.78, 0.14, 0.15, 0.86);
      &::after {
        content: '';
        background-image: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.3) 0%,
          rgba(255, 255, 255, 0.5) 100%
        );
        animation: progressRipple 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      @keyframes progressRipple {
        0% {
          position: absolute;
          inset: 0;
          right: 100%;
          opacity: 1;
        }
        66% {
          position: absolute;
          inset: 0;
          opacity: 0;
        }
        100% {
          position: absolute;
          inset: 0;
          opacity: 0;
        }
      }
    }
    .z-success-bg {
      background-color: @success !important;
    }
  }
}
</style>
