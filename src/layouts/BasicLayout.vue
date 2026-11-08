<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import GlobalHeader from '@/components/GlobalHeader.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'




const route = useRoute()
const isChatPage = computed(() => route.name === '应用对话')
const isAuthPage = computed(() => route.name === '用户登录' || route.name === '用户注册')
</script>

<template>
  <a-layout class="basic-layout">
    <a-layout-header v-if="!isAuthPage" class="layout-header">
      <GlobalHeader />
    </a-layout-header>

    <a-layout-content class="layout-content">
      <RouterView />
    </a-layout-content>

    <GlobalFooter v-if="!isChatPage && !isAuthPage" />
  </a-layout>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  color: #29273b;
  background: #f8f9fc;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
</style>

<style scoped>
.basic-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.layout-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 64px;
  padding: 0;
  line-height: 64px;
  background: #f8f9fc;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.layout-content {
  flex: 1;
  padding: 0;
  background: #fff;
}

@media (max-width: 768px) {
  .layout-content {
    padding: 0;
  }
}
</style>

