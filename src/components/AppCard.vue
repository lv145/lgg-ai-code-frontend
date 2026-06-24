<script setup lang="ts">
import { computed } from 'vue'
import { AppstoreOutlined, StarOutlined } from '@ant-design/icons-vue'
import defaultAvatar from '@/assets/aiAvatar.png'

const props = withDefaults(
  defineProps<{
    app: API.AppVO
    featured?: boolean
    currentUser?: API.LoginUserVO
  }>(),
  {
    featured: false,
  },
)

defineEmits<{
  chat: [appId: string]
  work: [deployKey: string]
}>()

const creatorName = computed(() => {
  if (props.currentUser?.id && String(props.currentUser.id) === String(props.app.userId)) {
    return props.currentUser.userName || '无名'
  }
  return props.app.userId ? `用户 ${props.app.userId}` : '无名'
})

const creatorAvatar = computed(() => {
  if (props.currentUser?.id && String(props.currentUser.id) === String(props.app.userId)) {
    return props.currentUser.userAvatar || defaultAvatar
  }
  return defaultAvatar
})

const footerText = computed(() => {
  if (props.featured) {
    return '精选应用'
  }
  return `创建于 ${formatTime(props.app.createTime || '')}`
})

const formatTime = (time: string) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  return `${months}个月前`
}
</script>

<template>
  <div class="app-card">
    <div class="app-header">
      <a-avatar :src="creatorAvatar" :size="44" class="app-creator-avatar">
        {{ creatorName.slice(0, 1) }}
      </a-avatar>
      <div class="app-meta">
        <h3 class="app-name">{{ app.appName }}</h3>
        <p class="app-owner">{{ creatorName }}</p>
      </div>
    </div>

    <div class="app-cover">
      <img v-if="app.cover" :src="app.cover" :alt="app.appName" />
      <div v-else class="app-cover-placeholder" :class="{ featured }">
        <StarOutlined v-if="featured" class="placeholder-icon" />
        <AppstoreOutlined v-else class="placeholder-icon" />
      </div>
      <div class="app-cover-actions">
        <a-button v-if="app.id" type="primary" size="large" @click.stop="$emit('chat', app.id)">
          查看对话
        </a-button>
        <a-button v-if="app.deployKey" size="large" @click.stop="$emit('work', app.deployKey)">
          查看作品
        </a-button>
      </div>
    </div>

    <div class="app-info">
      <p class="app-time">{{ footerText }}</p>
    </div>
  </div>
</template>

<style scoped>
.app-card {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 12px;
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.app-creator-avatar {
  flex-shrink: 0;
}

.app-meta {
  min-width: 0;
  flex: 1;
}

.app-name {
  margin: 0 0 6px;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-owner {
  margin: 0;
  color: #666;
  font-size: 13px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-cover {
  height: 200px;
  overflow: hidden;
  background: #f5f5f5;
  position: relative;
}

.app-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  opacity: 0;
  transition: opacity 0.2s;
}

.app-cover-actions {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.app-card:hover .app-cover::after,
.app-card:hover .app-cover-actions {
  opacity: 1;
}

.app-card:hover .app-cover-actions {
  pointer-events: auto;
}

.app-cover-actions :deep(.ant-btn) {
  min-width: 128px;
  height: 48px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 500;
}

.app-cover-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-cover-placeholder.featured {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.placeholder-icon {
  color: #fff;
  font-size: 48px;
}

.app-info {
  padding: 12px 16px 16px;
}

.app-time {
  font-size: 14px;
  color: #999;
  margin: 0;
}

@media (max-width: 768px) {
  .app-cover-actions {
    gap: 12px;
  }

  .app-cover-actions :deep(.ant-btn) {
    min-width: 112px;
    height: 44px;
    font-size: 16px;
  }

  .app-header {
    padding: 14px 14px 10px;
  }

  .app-info {
    padding: 10px 14px 14px;
  }
}
</style>
