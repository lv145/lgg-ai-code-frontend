<script setup lang="ts">
import { RouterView } from 'vue-router'
import GlobalHeader from '@/components/GlobalHeader.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'



</script>

<template>
  <a-layout class="basic-layout">
    <a-layout-header class="layout-header">
      <GlobalHeader />
    </a-layout-header>

    <a-layout-content class="layout-content">
      <RouterView />
    </a-layout-content>

    <GlobalFooter />
  </a-layout>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
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
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.layout-content {
  flex: 1;
  padding: 24px;
  background: #fff;
}

@media (max-width: 768px) {
  .layout-content {
    padding: 16px;
  }
}
</style>
