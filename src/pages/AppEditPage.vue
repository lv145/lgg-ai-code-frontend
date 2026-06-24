<template>
  <div id="appEditPage">
    <a-card title="应用信息修改" :bordered="false">
      <a-form
        :model="formData"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 16 }"
        @finish="handleSubmit"
      >
        <a-form-item label="应用名称" name="appName" :rules="[{ required: true, message: '请输入应用名称' }]">
          <a-input v-model:value="formData.appName" placeholder="请输入应用名称" />
        </a-form-item>

        <a-form-item label="应用封面" name="cover" v-if="isAdmin">
          <a-input v-model:value="formData.cover" placeholder="请输入封面图片URL" />
          <div class="cover-preview" v-if="formData.cover">
            <a-image :src="formData.cover" :width="200" />
          </div>
        </a-form-item>

        <a-form-item label="优先级" name="priority" v-if="isAdmin">
          <a-input-number v-model:value="formData.priority" :min="0" :max="99" />
          <div class="priority-tip">设置为99表示精选应用</div>
        </a-form-item>

        <a-divider orientation="left">应用信息</a-divider>

        <a-descriptions :column="1" bordered size="small" class="app-info-descriptions">
          <a-descriptions-item label="应用ID">{{ appInfo.id || appId }}</a-descriptions-item>
          <a-descriptions-item label="创建用户ID">{{ appInfo.userId || '-' }}</a-descriptions-item>
          <a-descriptions-item v-if="!isAdmin" label="创建用户">
          </a-descriptions-item>
          <a-descriptions-item label="初始提示词">{{ appInfo.initPrompt || '-' }}</a-descriptions-item>
          <a-descriptions-item label="代码生成类型">{{ appInfo.codeGenType || '-' }}</a-descriptions-item>
          <a-descriptions-item label="部署标识">{{ appInfo.deployKey || '-' }}</a-descriptions-item>
          <a-descriptions-item label="部署时间">{{ formatDate(appInfo.deployedTime) }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDate(appInfo.createTime) }}</a-descriptions-item>
          <a-descriptions-item v-if="isAdmin" label="编辑时间">
            {{ formatDate(adminAppInfo.editTime) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatDate(appInfo.updateTime) }}</a-descriptions-item>
        </a-descriptions>

        <a-form-item :wrapper-col="{ offset: 4, span: 16 }">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="loading">保存</a-button>
            <a-button @click="handleCancel">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getAppById, getAppVoById, updateApp, adminUpdateApp } from '@/api/appController'
import { useLoginUserStore } from '@/stores/loginUser'
import ACCESS_ENUM from '@/access/accessEnum'

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()
const appId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '')
})
const loading = ref(false)

// 应用信息
const appInfo = ref<API.App | API.AppVO>({})

// 表单数据
const formData = reactive({
  appName: '',
  cover: '',
  priority: 0,
})

// 是否是管理员
const isAdmin = computed(() => {
  return loginUserStore.loginUser?.userRole === ACCESS_ENUM.ADMIN
})
const adminAppInfo = computed(() => appInfo.value as API.App)


// 格式化日期
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


// 获取应用信息
const fetchAppInfo = async () => {
  if (!appId.value) return
  const res = isAdmin.value
    ? await getAppById({ id: appId.value })
    : await getAppVoById({ id: appId.value })
  if (res.data.code === 0 && res.data.data) {
    appInfo.value = res.data.data
    // 检查权限：普通用户只能编辑自己的应用
    if (!isAdmin.value && String(appInfo.value.userId) !== String(loginUserStore.loginUser?.id)) {
      message.error('您没有权限编辑此应用')
      router.back()
      return
    }
    // 初始化表单数据
    formData.appName = appInfo.value.appName || ''
    formData.cover = appInfo.value.cover || ''
    formData.priority = appInfo.value.priority || 0
  } else {
    message.error('获取应用信息失败')
    router.back()
  }
}

// 提交表单
const handleSubmit = async () => {
  loading.value = true
  try {
    let res
    if (isAdmin.value) {
      // 管理员可以修改所有字段
      res = await adminUpdateApp({
        id: appId.value,
        appName: formData.appName,
        cover: formData.cover,
        priority: formData.priority,
      })
    } else {
      // 普通用户只能修改应用名称
      res = await updateApp({
        id: appId.value,
        appName: formData.appName,
      })
    }

    if (res.data.code === 0) {
      message.success('保存成功')
      router.back()
    } else {
      message.error('保存失败：' + res.data.message)
    }
  } catch (error) {
    message.error('保存失败')
    console.error('Save error:', error)
  } finally {
    loading.value = false
  }
}

// 取消操作
const handleCancel = () => {
  router.back()
}

onMounted(() => {
  fetchAppInfo()
})
</script>

<style scoped>
#appEditPage {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.cover-preview {
  margin-top: 12px;
}

.priority-tip {
  margin-top: 4px;
  color: #999;
  font-size: 12px;
}

.app-info-descriptions {
  margin-bottom: 24px;
}

.app-info-descriptions :deep(.ant-descriptions-item-label) {
  width: 140px;
}

.app-info-descriptions :deep(.ant-descriptions-item-content) {
  word-break: break-all;
}
</style>
