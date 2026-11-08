<script setup lang="ts">
import { COPYRIGHT_TEXT } from '@/constants/site'

const footerLink = 'https://github.com/'
</script>

<template>
  <a-layout-footer class="global-footer">
    <a :href="footerLink" target="_blank" rel="noopener noreferrer">{{ COPYRIGHT_TEXT }}</a>
  </a-layout-footer>
</template>

<style scoped>
.global-footer {
  flex-shrink: 0;
  padding: 16px 24px;
  text-align: center;
  background: #f8f9fc;
  border-top: 1px solid #efedf3;
}

.global-footer a {
  color: #898697;
  text-decoration: none;
  transition: color 0.3s;
}

.global-footer a:hover {
  color: #7161ce;
}
</style>
