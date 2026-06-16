<script setup lang="ts">
const footerLink = 'https://github.com/'
</script>

<template>
  <a-layout-footer class="global-footer">
    <a :href="footerLink" target="_blank" rel="noopener noreferrer"> AI-Code by Lgg </a>
  </a-layout-footer>
</template>

<style scoped>
.global-footer {
  flex-shrink: 0;
  padding: 16px 24px;
  text-align: center;
  background: #f5f5f5;
  border-top: 1px solid #f0f0f0;
}

.global-footer a {
  color: rgba(0, 0, 0, 0.65);
  text-decoration: none;
  transition: color 0.3s;
}

.global-footer a:hover {
  color: #1677ff;
}
</style>
