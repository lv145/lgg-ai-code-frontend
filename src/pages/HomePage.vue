<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PaperClipOutlined, SendOutlined, SwapOutlined } from '@ant-design/icons-vue'
import { addApp, listAppVoByPage, listMyAppVoByPage, listFeaturedAppVoByPage } from '@/api/appController'
import { useLoginUserStore } from '@/stores/loginUser'
import ACCESS_ENUM from '@/access/accessEnum'
import AppCard from '@/components/AppCard.vue'

const router = useRouter()
const loginUserStore = useLoginUserStore()
const deployBaseUrl = import.meta.env.VITE_APP_DEPLOY_BASE_URL || 'http://localhost'
const pendingPromptStoragePrefix = 'app-chat-pending-prompt:'
const isAdmin = computed(() => loginUserStore.loginUser?.userRole === ACCESS_ENUM.ADMIN)
const myAppsTitle = computed(() => (isAdmin.value ? '全部作品' : '我的作品'))

// 提示词输入
const prompt = ref('')
const isAgentModel = ref(false)
const isCreatingApp = ref(false)

// 推荐关键词列表
const recommendKeywords = [
  'AI 简历优化助手',
  '短视频脚本生成器',
  '个人作品集网站',
  '独立开发者产品官网',
  '小红书选题日历',
  '跨境电商运营看板',
  '健身饮食打卡工具',
  '旅行行程规划器',
  '在线课程学习计划表',
  '咖啡品牌预约点单页',
]

// 使用推荐关键词填充输入框
const useKeyword = (keyword: string) => {
  prompt.value = keyword
}

const toggleAgentModel = () => {
  isAgentModel.value = !isAgentModel.value
}

// 我的应用数据
const myApps = ref<API.AppVO[]>([])
const myAppsTotal = ref(0)
const myAppsParams = reactive<API.AppUserQueryRequest>({
  pageNum: 1,
  pageSize: 6,
})

// 精选应用数据
const featuredApps = ref<API.AppVO[]>([])
const featuredAppsTotal = ref(0)
const featuredAppsParams = reactive<API.AppUserQueryRequest>({
  pageNum: 1,
  pageSize: 6,
})

// 创建应用
const handleCreateApp = async () => {
  if (isCreatingApp.value) {
    return
  }
  if (!prompt.value.trim()) {
    message.warning('请输入提示词')
    return
  }
  if (!loginUserStore.loginUser?.id) {
    message.warning('请先登录')
    router.push('/user/login')
    return
  }
  const initPrompt = prompt.value.trim()
  isCreatingApp.value = true
  try {
    const res = await addApp({ initPrompt, isAgentModel: isAgentModel.value })
    if (res.data.code === 0 && res.data.data) {
      const appId = String(res.data.data)
      sessionStorage.setItem(`${pendingPromptStoragePrefix}${appId}`, initPrompt)
      message.success('应用创建成功')
      router.push(`/app/chat/${appId}`)
    } else {
      message.error('创建失败：' + res.data.message)
    }
  } finally {
    isCreatingApp.value = false
  }
}

// 获取我的应用列表
const fetchMyApps = async () => {
  const res = isAdmin.value
    ? await listAppVoByPage(myAppsParams)
    : await listMyAppVoByPage(myAppsParams)
  if (res.data.code === 0 && res.data.data) {
    myApps.value = res.data.data.records ?? []
    myAppsTotal.value = res.data.data.totalRow ?? 0
  }
}

// 获取精选应用列表
const fetchFeaturedApps = async () => {
  const res = await listFeaturedAppVoByPage(featuredAppsParams)
  if (res.data.code === 0 && res.data.data) {
    featuredApps.value = res.data.data.records ?? []
    featuredAppsTotal.value = res.data.data.totalRow ?? 0
  }
}

// 我的应用分页变化
const handleMyAppsPageChange = (page: number, pageSize: number) => {
  myAppsParams.pageNum = page
  myAppsParams.pageSize = pageSize
  fetchMyApps()
}

// 精选应用分页变化
const handleFeaturedAppsPageChange = (page: number, pageSize: number) => {
  featuredAppsParams.pageNum = page
  featuredAppsParams.pageSize = pageSize
  fetchFeaturedApps()
}

// 跳转到应用对话页
const goToAppChat = (appId: string) => {
  router.push(`/app/chat/${appId}`)
}

// 打开查看作品
const openAppWork = (deployKey?: string) => {
  if (!deployKey) return
  window.open(`${deployBaseUrl}/${deployKey}`, '_blank', 'noopener,noreferrer')
}

onMounted(async () => {
  if (!loginUserStore.loginUser?.id) {
    await loginUserStore.fetchLoginUser()
  }
  fetchMyApps()
  fetchFeaturedApps()
})
</script>

<template>
  <div class="home-page">
    <!-- 顶部区域 -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">AI 应用生成平台</h1>
        <p class="hero-subtitle">一句话轻松创建网站应用</p>
        
        <!-- 输入框区域 -->
        <div class="prompt-input-wrapper">
          <a-textarea
            v-model:value="prompt"
            placeholder="帮我创建个人博客网站"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            class="prompt-input"
          />
          <div class="prompt-actions">
            <div class="action-buttons">
              <a-button type="text">
                <template #icon><PaperClipOutlined /></template>
                上传
              </a-button>
              <a-tooltip :title="isAgentModel ? '切换为 AI 对话模式' : '切换为 AI Agent 工作流模式'">
                <a-button
                  type="text"
                  class="mode-toggle-button"
                  :class="{ active: isAgentModel }"
                  @click="toggleAgentModel"
                >
                  <template #icon><SwapOutlined /></template>
                  {{ isAgentModel ? 'Agent 工作流' : 'AI 对话' }}
                </a-button>
              </a-tooltip>
            </div>
            <a-button 
              type="primary" 
              shape="circle" 
              :disabled="!prompt.trim() || isCreatingApp"
              :loading="isCreatingApp"
              @click="handleCreateApp"
            >
              <template #icon><SendOutlined /></template>
            </a-button>
          </div>
        </div>
        
        <!-- 推荐关键词 -->
        <div class="recommend-keywords">
          <div class="keywords-label">推荐：</div>
          <div class="keywords-list">
            <a-tag 
              v-for="keyword in recommendKeywords" 
              :key="keyword"
              class="keyword-tag"
              @click="useKeyword(keyword)"
            >
              {{ keyword }}
            </a-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的应用列表 -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">{{ myAppsTitle }}</h2>
      </div>
      <div class="app-grid">
        <AppCard
          v-for="app in myApps"
          :key="app.id"
          :app="app"
          :current-user="loginUserStore.loginUser"
          @chat="goToAppChat"
          @work="openAppWork"
        />
        <div v-if="myApps.length === 0" class="empty-state">
          <a-empty description="暂无应用，去创建一个吧！" />
        </div>
      </div>
      <div class="pagination-wrapper" v-if="myAppsTotal > 6">
        <a-pagination
          :current="myAppsParams.pageNum"
          :pageSize="myAppsParams.pageSize"
          :total="myAppsTotal"
          show-size-changer
          :page-size-options="['6', '12', '18', '24']"
          @change="handleMyAppsPageChange"
        />
      </div>
    </div>

    <!-- 精选应用列表 -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">精选案例</h2>
      </div>
      <div class="app-grid">
        <AppCard
          v-for="app in featuredApps"
          :key="app.id"
          :app="app"
          :current-user="loginUserStore.loginUser"
          featured
          @chat="goToAppChat"
          @work="openAppWork"
        />
        <div v-if="featuredApps.length === 0" class="empty-state">
          <a-empty description="暂无精选应用" />
        </div>
      </div>
      <div class="pagination-wrapper" v-if="featuredAppsTotal > 6">
        <a-pagination
          :current="featuredAppsParams.pageNum"
          :pageSize="featuredAppsParams.pageSize"
          :total="featuredAppsTotal"
          show-size-changer
          :page-size-options="['6', '12', '18', '24']"
          @change="handleFeaturedAppsPageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at 18% 8%, rgba(24, 144, 255, 0.32) 0, transparent 28%),
    radial-gradient(circle at 86% 12%, rgba(114, 46, 209, 0.28) 0, transparent 30%),
    linear-gradient(135deg, #eef7ff 0%, #f8fbff 42%, #edf4ff 100%);
}

.hero-section {
  padding: 72px 20px 38px;
  text-align: center;
}

.hero-content {
  max-width: 920px;
  margin: 0 auto;
}

.hero-title {
  margin: 0 0 16px;
  color: #0f172a;
  font-size: 56px;
  font-weight: 800;
  line-height: 1.12;
}

.hero-subtitle {
  margin: 0 0 36px;
  color: #475569;
  font-size: 20px;
}

.prompt-input-wrapper {
  max-width: 760px;
  margin: 0 auto;
  padding: 18px;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(30, 64, 175, 0.16);
}

.prompt-input {
  border: none;
  box-shadow: none;
  font-size: 16px;
  background: transparent;
}

.prompt-input:focus {
  box-shadow: none;
}

.prompt-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-toggle-button {
  color: #475569;
  border-radius: 16px;
  transition: all 0.2s;
}

.mode-toggle-button.active {
  color: #1677ff;
  background: rgba(22, 119, 255, 0.1);
}

.recommend-keywords {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  margin-top: 22px;
  flex-wrap: wrap;
  gap: 12px;
}

.keywords-label {
  padding-top: 8px;
  color: #64748b;
  font-size: 14px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  max-width: 980px;
}

.keyword-tag {
  max-width: 310px;
  padding: 8px 12px;
  cursor: pointer;
  color: #1e293b;
  white-space: normal;
  text-align: left;
  line-height: 1.55;
  transition: all 0.2s;
  border-color: rgba(59, 130, 246, 0.18);
  background: rgba(255, 255, 255, 0.78);
}

.keyword-tag:hover {
  color: #1677ff;
  border-color: #1677ff;
  background: #fff;
  transform: translateY(-1px);
}

.section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.section-header {
  margin-bottom: 24px;
}

.section-title {
  font-size: 28px;
  font-weight: 600;
  color: #0f172a;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 36px;
  }
  
  .hero-subtitle {
    font-size: 16px;
  }
  
  .app-grid {
    grid-template-columns: 1fr;
  }

}
</style>
