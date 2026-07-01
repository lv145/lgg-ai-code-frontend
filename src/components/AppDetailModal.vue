<script setup lang="ts">
import { computed } from 'vue'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue'
import { getCodeGenTypeLabel } from '@/constants/codeGenType'

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
const codeGenTypeLabel = computed(() => getCodeGenTypeLabel(props.appInfo.codeGenType))

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
  <a-modal
    v-model:open="modalOpen"
    :footer="null"
    :width="520"
    title="应用详情"
    centered
    class="app-detail-modal"
  >
    <div class="app-detail-panel">
      <div class="detail-list">
        <div class="detail-row">
          <div class="detail-label">创建者：</div>
          <div class="detail-content">
            <div class="creator-info">
              <a-avatar :src="creatorInfo.userAvatar" :size="32">
                {{ creatorName.slice(0, 1) }}
              </a-avatar>
              <span class="creator-name">{{ creatorName }}</span>
            </div>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-label">创建时间：</div>
          <div class="detail-content">
            <span class="detail-value">{{ formatDate(appInfo.createTime) }}</span>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-label">生成类型：</div>
          <div class="detail-content">
            <a-tag color="blue" class="code-type-tag">{{ codeGenTypeLabel }}</a-tag>
          </div>
        </div>
      </div>

      <template v-if="canManageApp">
        <a-divider class="detail-divider" />
        <div class="detail-actions">
          <a-button type="primary" size="large" class="detail-action-button" @click="$emit('edit')">
            <template #icon><EditOutlined /></template>
            修改
          </a-button>
          <a-button danger size="large" class="detail-action-button" @click="$emit('delete')">
            <template #icon><DeleteOutlined /></template>
            删除
          </a-button>
        </div>
      </template>
    </div>
  </a-modal>
</template>

<style scoped>
.app-detail-panel {
  padding: 8px 4px 0;
}

.app-detail-modal :deep(.ant-modal-header) {
  margin-bottom: 8px;
}

.app-detail-modal :deep(.ant-modal-title) {
  color: #1f2933;
  font-size: 18px;
  font-weight: 600;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
}

.detail-label {
  color: #6b7280;
  font-size: 16px;
  line-height: 24px;
}

.creator-info {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.creator-name,
.detail-value {
  min-width: 0;
  color: #1f2933;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-content {
  min-width: 0;
}

.code-type-tag {
  margin-inline-end: 0;
  padding: 1px 8px;
  font-size: 14px;
  line-height: 1.5;
}

.detail-divider {
  margin: 24px 0 18px;
}

.detail-actions {
  display: flex;
  justify-content: flex-start;
  gap: 16px;
}

.detail-action-button {
  min-width: 88px;
  height: 36px;
  border-radius: 8px;
  font-size: 16px;
}

@media (max-width: 768px) {
  .app-detail-panel {
    padding: 4px 0;
  }

  .detail-row {
    grid-template-columns: 84px minmax(0, 1fr);
  }

  .detail-label,
  .creator-name,
  .detail-value {
    font-size: 14px;
  }

  .code-type-tag {
    font-size: 13px;
  }

  .detail-actions {
    gap: 10px;
  }

  .detail-action-button {
    min-width: 80px;
    font-size: 14px;
  }
}
</style>
