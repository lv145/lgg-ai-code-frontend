<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ content?: string }>()
defineEmits<{ view: [content: string] }>()

const preview = ref<HTMLElement>()
const isTruncated = ref(false)
let resizeObserver: ResizeObserver | undefined

const measureOverflow = () => {
  const element = preview.value
  isTruncated.value = !!element && element.scrollHeight > element.clientHeight + 1
}

watch(() => props.content, async () => {
  await nextTick()
  measureOverflow()
})

onMounted(() => {
  resizeObserver = new ResizeObserver(measureOverflow)
  if (preview.value) resizeObserver.observe(preview.value)
  measureOverflow()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div class="message-cell">
    <div ref="preview" class="message-preview">{{ content || '-' }}</div>
    <a-button
      v-if="isTruncated"
      type="link"
      size="small"
      class="view-message-button"
      @click="$emit('view', content || '-')"
    >
      查看
    </a-button>
  </div>
</template>

<style scoped>
.message-cell {
  min-width: 0;
}

.message-preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  max-height: 66px;
  overflow: hidden;
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.view-message-button {
  height: auto;
  margin-top: 6px;
  padding: 0;
}
</style>
