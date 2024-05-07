<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'Button'
})
</script>

<template>
  <button class="z-button">
    <slot></slot>
  </button>
</template>

<style scoped lang="less"></style>
