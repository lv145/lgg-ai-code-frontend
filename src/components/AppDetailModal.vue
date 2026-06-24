<script setup lang="ts">
import { computed } from 'vue'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  open: boolean
  appInfo: API.App | API.AppVO
  creatorInfo: API.UserVO
  canManageApp: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  edit: []
  delete: []
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const creatorName = computed(() => props.creatorInfo.userName || '无名')

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <a-modal v-model:open="modalOpen" :footer="null" :width="620" centered class="app-detail-modal">
    <div class="app-detail-panel">
      <h3 class="detail-title">基础信息</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">创建者</div>
          <div class="creator-info">
            <a-avatar :src="creatorInfo.userAvatar" :size="32">
              {{ creatorName.slice(0, 1) }}
            </a-avatar>
            <span class="creator-name">{{ creatorName }}</span>
          </div>
        </div>
        <div class="detail-item">
          <div class="detail-label">创建时间</div>
          <div class="detail-value">{{ formatDate(appInfo.createTime) }}</div>
        </div>
      </div>

      <template v-if="canManageApp">
        <a-divider class="detail-divider" />
        <div class="detail-actions">
          <a-button type="text" class="detail-action-button" @click="$emit('edit')">
            <template #icon><EditOutlined /></template>
            修改作品
          </a-button>
          <a-button type="text" danger class="detail-action-button" @click="$emit('delete')">
            <template #icon><DeleteOutlined /></template>
            删除作品
          </a-button>
        </div>
      </template>
    </div>
  </a-modal>
</template>

<style scoped>
.app-detail-panel {
  padding: 8px 8px 4px;
}

.detail-title {
  margin: 0 0 24px;
  font-size: 22px;
  font-weight: 600;
  color: #1f2933;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 40px;
}

.detail-label {
  margin-bottom: 10px;
  color: #8c8c8c;
  font-size: 16px;
}

.creator-info {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.creator-name,
.detail-value {
  min-width: 0;
  color: #1f2933;
  font-size: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-divider {
  margin: 28px 0 16px;
}

.detail-actions {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.detail-action-button {
  height: 42px;
  padding: 0 12px;
  font-size: 18px;
}

@media (max-width: 768px) {
  .app-detail-panel {
    padding: 4px 0;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .detail-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
}
</style>
