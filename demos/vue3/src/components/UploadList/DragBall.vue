<template>
  <teleport to="body">
    <div class="ball-box" ref="boxRef" :style="style">
      <div class="ball-box-inner">
        <div class="inner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            version="1.0"
            viewBox="0 0 600 140"
            class="box-waves"
          >
            <path
              d="M 0 70 Q 75 20,150 70 T 300 70 T 450 70 T 600 70 L 600 140 L 0 140 L 0 70Z"
            ></path>
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            version="1.0"
            viewBox="0 0 600 140"
            class="box-waves"
          >
            <path
              d="M 0 70 Q 75 20,150 70 T 300 70 T 450 70 T 600 70 L 600 140 L 0 140 L 0 70Z"
            ></path>
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            version="1.0"
            viewBox="0 0 600 140"
            class="box-waves"
          >
            <path
              d="M 0 70 Q 75 20,150 70 T 300 70 T 450 70 T 600 70 L 600 140 L 0 140 L 0 70Z"
            ></path>
          </svg>
        </div>
        <div class="text">
          <div>
            {{ formatPercentage + '%' }}
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue'
import { useDraggable } from '@vueuse/core'

const props = defineProps({
  percentage: {
    type: Number,
    default: 20,
    validator(v: number) {
      return v >= 0 && v <= 100
    }
  }
})

const boxRef = ref<HTMLElement | null>(null)
const { style, x, y } = useDraggable(boxRef, {
  initialValue: { x: 100, y: 100 }
})

const text = ref('当前进度')

const bottomStyle = ref('-128%')

const formatPercentage = computed(() => {
  if (props.percentage < 0) {
    return 0
  } else if (props.percentage > 100) {
    return 100
  }
  return props.percentage
})
watchEffect(() => {
  bottomStyle.value = -128 + formatPercentage.value + '%'
})
</script>

<style scoped lang="less">
.ball-box {
  user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
  position: fixed;
  cursor: move;
  z-index: 1000;
}

.ball-box-inner {
  width: 120px;
  height: 120px;
  box-shadow: 0 2px 7px 0 #238fdb;
  border-radius: 50%;
  position: relative;
  border: 2px solid transparent;
  background-image: linear-gradient(#021f40, #021f40),
    linear-gradient(180deg, rgba(36, 144, 220, 0.41), rgba(37, 147, 225, 1));
  background-origin: border-box;
  background-clip: content-box, border-box;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text {
  color: white;
  font-size: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.inner {
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  background: #a0edff;
  /* 直接对bottom操作 */
  bottom: v-bind(bottomStyle);
}

.box-waves {
  position: absolute;
  left: 0;
  bottom: 100%;
  width: 200%;
  stroke: none;
}

.box-waves:nth-child(1) {
  fill: #a0edff;
  transform: translate(-50%, 0);
  z-index: 3;
  animation: wave-move1 1.5s linear infinite;
  /* svg重合有一条线 */
  margin-bottom: -2px;
}

.box-waves:nth-child(2) {
  fill: rgba(40, 187, 255, 0.5);
  transform: translate(0, 0);
  z-index: 2;
  animation: wave-move2 3s linear infinite;
}

.box-waves:nth-child(3) {
  fill: #2084cc;
  transform: translate(-50%, 0);
  z-index: 1;
  animation: wave-move1 3s linear infinite;
}

@keyframes wave-move1 {
  100% {
    transform: translate(0, 0);
  }
}

@keyframes wave-move2 {
  100% {
    transform: translate(-50%, 0);
  }
}

.box-text {
  font-size: 30px;
  font-weight: bold;
  width: 80px;
  margin-left: 20px;
  text-align: center;
  color: #7eedff;
}
</style>
