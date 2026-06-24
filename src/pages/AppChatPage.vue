<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github.css'
import {
  SendOutlined,
  RocketOutlined,
  UserOutlined,
  PaperClipOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined
} from '@ant-design/icons-vue'
import { getAppById, getAppVoById, deployApp, deleteApp, adminDeleteApp } from '@/api/appController'
import {
  listAppChatHistoryByPage,
  listChatHistoryVoByPage,
} from '@/api/chatHistoryController'
import { getUserVoById } from '@/api/userController'
import { useLoginUserStore } from '@/stores/loginUser'
import ACCESS_ENUM from '@/access/accessEnum'
import aiAvatar from '@/assets/aiAvatar.png'
import AppDetailModal from '@/components/AppDetailModal.vue'

hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()
const appId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '')
})
const isOwnApp = computed(() => {
  return !!appInfo.value.userId && String(appInfo.value.userId) === String(loginUserStore.loginUser?.id)
})
const canChat = computed(() => {
  return !appInfo.value.userId || isOwnApp.value
})
const isAdmin = computed(() => loginUserStore.loginUser?.userRole === ACCESS_ENUM.ADMIN)
const canManageApp = computed(() => isOwnApp.value || isAdmin.value)
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')
const backendOrigin = apiBaseUrl.replace(/\/api\/?$/, '')
const pendingPromptStoragePrefix = 'app-chat-pending-prompt:'

// 应用信息
const appInfo = ref<API.App | API.AppVO>({})
const creatorInfo = ref<API.UserVO>({})

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  createTime?: string
  html?: string
}

// 对话相关
const messages = ref<ChatMessage[]>([])
const userInput = ref('')
const isLoading = ref(false)
const isStreaming = ref(false)
const isHistoryLoading = ref(false)
const hasMoreHistory = ref(false)
const historyTotal = ref(0)
const historyLoaded = ref(false)
const historyCursor = ref<string>()
const currentStreamingMessage = ref('')
let streamingDraft = ''
let streamingFlushTimer: number | undefined

// 网页预览相关
const previewUrl = ref('')
const previewStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const previewFrameKey = ref(0)
const isDeploying = ref(false)
const detailModalOpen = ref(false)
const deploySuccessModalOpen = ref(false)
const deployedUrl = ref('')

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  highlight: (code, lang) => {
    const language = lang?.trim().toLowerCase()
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value
    }
    return hljs.highlightAuto(code, ['html', 'css', 'javascript', 'typescript']).value
  },
})

const renderMarkdown = (content: string) => {
  if (!content) return ''
  return markdown.render(content)
}

const formatMessageTime = (time?: string) => {
  if (!time) return ''
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) {
    return time
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getHistoryRole = (messageType?: string): ChatMessage['role'] => {
  const normalizedType = messageType?.toLowerCase()
  if (normalizedType === 'user') {
    return 'user'
  }
  return 'assistant'
}

const toChatMessage = (history: API.ChatHistory): ChatMessage => {
  const role = getHistoryRole(history.messageType)
  const content = history.message || ''
  return {
    role,
    content,
    createTime: history.createTime,
    html: role === 'assistant' ? renderMarkdown(content) : undefined,
  }
}

const sortHistoriesAsc = (records: API.ChatHistory[]) => {
  return [...records].sort((left, right) => {
    return new Date(left.createTime || '').getTime() - new Date(right.createTime || '').getTime()
  })
}

const refreshHistoryCursor = () => {
  historyCursor.value = messages.value.find((item) => item.createTime)?.createTime
}

const refreshHasMoreHistory = (recordsLength: number) => {
  if (historyTotal.value > 0) {
    hasMoreHistory.value = messages.value.length < historyTotal.value
    return
  }
  hasMoreHistory.value = recordsLength >= 10
}

const listCurrentAppHistory = (loadMore: boolean) => {
  if (isAdmin.value) {
    const body: API.ChatHistoryQueryRequest = {
      appId: appId.value,
      pageSize: 10,
    }
    if (loadMore && historyCursor.value) {
      body.lastCreateTime = historyCursor.value
    }
    return listChatHistoryVoByPage(body)
  }

  const params: API.listAppChatHistoryByPageParams = {
    appId: appId.value,
    pageSize: 10,
  }
  if (loadMore && historyCursor.value) {
    params.lastCreateTime = historyCursor.value
  }
  return listAppChatHistoryByPage(params)
}

const getGeneratedPreviewUrl = () => {
  return `${apiBaseUrl}/static/${appInfo.value.codeGenType}_${appId.value}/`
}

const sleep = (ms: number) => {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

const resetStreamingContent = () => {
  streamingDraft = ''
  currentStreamingMessage.value = ''
  if (streamingFlushTimer) {
    window.clearTimeout(streamingFlushTimer)
    streamingFlushTimer = undefined
  }
}

const flushStreamingContent = async () => {
  streamingFlushTimer = undefined
  currentStreamingMessage.value = streamingDraft
  await nextTick()
  scrollToBottom()
}

const appendStreamingContent = (text: string) => {
  streamingDraft += text
  if (streamingFlushTimer) {
    return
  }

  streamingFlushTimer = window.setTimeout(() => {
    flushStreamingContent()
  }, 120)
}
// 检查预览是否准备就绪
const checkPreviewReady = async (url: string) => {
  // 如果预览未准备就绪，等待5秒后重试
  // 如果5秒后仍未准备就绪，返回false
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}
// 加载生成的预览
const loadGeneratedPreview = async () => {
  //
  if (!appInfo.value.codeGenType) {
    return false
  }

  const url = getGeneratedPreviewUrl()
  previewStatus.value = 'loading'

  for (let index = 0; index < 10; index += 1) {
    const ready = await checkPreviewReady(url)
    if (ready) {
      previewUrl.value = `${url}?t=${Date.now()}`
      previewFrameKey.value += 1
      previewStatus.value = 'ready'
      return true
    }
    await sleep(600)
  }

  previewStatus.value = 'error'
  return false
}

const restoreGeneratedPreview = async () => {
  if (!appInfo.value.codeGenType) {
    return false
  }

  const ready = await checkPreviewReady(getGeneratedPreviewUrl())
  if (!ready) {
    return false
  }

  previewUrl.value = `${getGeneratedPreviewUrl()}?t=${Date.now()}`
  previewFrameKey.value += 1
  previewStatus.value = 'ready'
  return true
}

const consumePendingPrompt = () => {
  const storageKey = `${pendingPromptStoragePrefix}${appId.value}`
  const pendingPrompt = sessionStorage.getItem(storageKey)
  if (pendingPrompt) {
    sessionStorage.removeItem(storageKey)
  }
  return pendingPrompt?.trim() || ''
}

const getSseMessageContent = (rawData: string) => {
  if (!rawData || rawData === '""' || rawData === '[DONE]') {
    return ''
  }

  try {
    const parsed = JSON.parse(rawData)
    if (typeof parsed === 'string') {
      return parsed
    }
    return parsed?.d ?? parsed?.content ?? parsed?.text ?? ''
  } catch {
    return rawData
  }
}

const fetchCreatorInfo = async () => {
  if (!appInfo.value.userId) {
    creatorInfo.value = {}
    return
  }

  try {
    const res = await getUserVoById({ id: appInfo.value.userId })
    if (res.data.code === 0 && res.data.data) {
      creatorInfo.value = res.data.data
    }
  } catch (error) {
    console.error('Fetch creator error:', error)
  }
}

const handleEditApp = () => {
  if (!canManageApp.value) return
  const editPath = isAdmin.value ? `/admin/appManage/edit/${appId.value}` : `/app/edit/${appId.value}`
  router.push(editPath)
}

const handleDeleteApp = () => {
  if (!canManageApp.value) return

  Modal.confirm({
    title: '确认删除应用',
    content: '删除后无法恢复，确定要删除这个应用吗？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const res = isAdmin.value
        ? await adminDeleteApp({ id: appId.value })
        : await deleteApp({ id: appId.value })
      if (res.data.code === 0) {
        message.success('删除成功')
        router.push('/')
      } else {
        message.error('删除失败：' + res.data.message)
      }
    },
  })
}

// 获取应用信息
const loadHistory = async (loadMore = false) => {
  if (!appId.value || isHistoryLoading.value) return
  isHistoryLoading.value = true
  const chatContainer = document.querySelector('.chat-messages')
  const previousScrollHeight = chatContainer?.scrollHeight ?? 0
  try {
    const res = await listCurrentAppHistory(loadMore)
    if (res.data.code === 0 && res.data.data) {
      historyTotal.value = res.data.data.totalRow ?? 0
      const records = sortHistoriesAsc(res.data.data.records ?? [])
      const historyMessages = records.map(toChatMessage)
      messages.value = loadMore ? [...historyMessages, ...messages.value] : historyMessages
      refreshHistoryCursor()
      refreshHasMoreHistory(records.length)
      historyLoaded.value = true
      await nextTick()
      if (loadMore) {
        const updatedChatContainer = document.querySelector('.chat-messages')
        if (updatedChatContainer) {
          updatedChatContainer.scrollTop = updatedChatContainer.scrollHeight - previousScrollHeight
        }
      } else {
        scrollToBottom()
      }
    } else {
      message.error('获取对话历史失败：' + res.data.message)
    }
  } catch (error) {
    message.error('获取对话历史失败')
    console.error('Fetch chat history error:', error)
  } finally {
    isHistoryLoading.value = false
  }
}

const fetchCurrentAppInfo = () => {
  const params = { id: appId.value }
  return isAdmin.value ? getAppById(params) : getAppVoById(params)
}

const fetchAppInfo = async () => {
  if (!appId.value) return
  if (!loginUserStore.loginUser?.id) {
    await loginUserStore.fetchLoginUser()
  }
  const res = await fetchCurrentAppInfo()
  if (res.data.code === 0 && res.data.data) {
    appInfo.value = res.data.data
    await fetchCreatorInfo()
    await loadHistory()
    if (messages.value.length >= 2) {
      await restoreGeneratedPreview()
    }

    const pendingPrompt = consumePendingPrompt()
    const autoPrompt = pendingPrompt || appInfo.value.initPrompt || ''
    if (autoPrompt && canChat.value && messages.value.length === 0) {
      await sendMessage(autoPrompt)
    }
  }
}

// 发送消息
const sendMessage = async (content: string) => {
  if (!canChat.value) {
    message.warning('无法在别人的作品下对话哦~')
    return
  }
  if (!content.trim() || isLoading.value) return

  // 添加用户消息
  messages.value.push({ role: 'user', content, createTime: new Date().toISOString() })
  userInput.value = ''

  // 滚动到底部
  await nextTick()
  scrollToBottom()

  // 开始流式请求
  isLoading.value = true
  isStreaming.value = true
  previewStatus.value = 'idle'
  resetStreamingContent()

  try {
    const url = new URL('/api/app/chat/gen/code', backendOrigin)
    url.searchParams.set('appId', String(appId.value))
    url.searchParams.set('message', content)
    const response = await fetch(url.toString(), {
      credentials: 'include',
    })
    if (!response.ok || !response.body) {
      throw new Error(`SSE request failed: ${response.status}`)
    }
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 按行解析 SSE 数据
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const rawData = line.slice(5).trim()
          const text = getSseMessageContent(rawData)
          if (text) {
            appendStreamingContent(text)
          }
        } else if (line.startsWith('event:done')) {
          // 流结束
        }
      }
    }

    if (streamingFlushTimer) {
      window.clearTimeout(streamingFlushTimer)
      streamingFlushTimer = undefined
    }
    currentStreamingMessage.value = streamingDraft

    // 添加AI回复
    if (currentStreamingMessage.value) {
      const content = currentStreamingMessage.value
      messages.value.push({
        role: 'assistant',
        content,
        createTime: new Date().toISOString(),
        html: renderMarkdown(content),
      })
      resetStreamingContent()

      await loadGeneratedPreview()
    }
  } catch (error) {
    message.error('对话请求失败')
    console.error('Chat error:', error)
  } finally {
    isLoading.value = false
    isStreaming.value = false
  }
}

// 处理输入框回车
const handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage(userInput.value)
  }
}

// 部署应用
const handleDeploy = async () => {
  if (!appId.value || isDeploying.value) return
  isDeploying.value = true

  try {
    const res = await deployApp({ appId: appId.value })
    if (res.data.code === 0 && res.data.data) {
      message.success('部署成功')
      deployedUrl.value = res.data.data
      await loadGeneratedPreview()
      deploySuccessModalOpen.value = true
    } else {
      message.error('部署失败：' + res.data.message)
    }
  } catch (error) {
    message.error('部署请求失败')
    console.error('Deploy error:', error)
  } finally {
    isDeploying.value = false
  }
}

const copyDeployedUrl = async () => {
  if (!deployedUrl.value) return
  try {
    await navigator.clipboard.writeText(deployedUrl.value)
    message.success('链接已复制')
  } catch {
    message.error('复制失败，请手动复制链接')
  }
}

const openDeployedUrl = () => {
  if (!deployedUrl.value) return
  window.open(deployedUrl.value, '_blank', 'noopener,noreferrer')
}

// 滚动到底部
const scrollToBottom = () => {
  const chatContainer = document.querySelector('.chat-messages')
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight
  }
}

onMounted(() => {
  fetchAppInfo()
})
</script>

<template>
  <div class="chat-page">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <a-button type="text" @click="router.back()">
          <template #icon><ArrowLeftOutlined /></template>
        </a-button>
        <h1 class="app-title">{{ appInfo.appName || '应用生成中...' }}</h1>
      </div>
      <div class="top-bar-right">
        <a-button @click="detailModalOpen = true">
          <template #icon><InfoCircleOutlined /></template>
          应用详情
        </a-button>
        <a-button
          type="primary"
          @click="handleDeploy"
          :disabled="!appId"
          :loading="isDeploying"
        >
          <template #icon><RocketOutlined /></template>
          部署
        </a-button>
      </div>
    </div>

    <AppDetailModal
      v-model:open="detailModalOpen"
      :app-info="appInfo"
      :creator-info="creatorInfo"
      :can-manage-app="canManageApp"
      @edit="handleEditApp"
      @delete="handleDeleteApp"
    />

    <a-modal
      v-model:open="deploySuccessModalOpen"
      title="部署成功"
      :footer="null"
      :width="620"
      centered
      class="deploy-success-modal"
    >
      <div class="deploy-success-panel">
        <CheckCircleOutlined class="deploy-success-icon" />
        <h3 class="deploy-success-title">网站部署成功！</h3>
        <p class="deploy-success-desc">你的网站已经成功部署，可以通过以下链接访问：</p>

        <div class="deploy-url-box">
          <span class="deploy-url-text">{{ deployedUrl }}</span>
          <a-button type="text" class="copy-url-button" @click="copyDeployedUrl">
            <template #icon><CopyOutlined /></template>
          </a-button>
        </div>

        <div class="deploy-success-actions">
          <a-button type="primary" @click="openDeployedUrl">访问网站</a-button>
          <a-button @click="deploySuccessModalOpen = false">关闭</a-button>
        </div>
      </div>
    </a-modal>

    <!-- 核心内容区域 -->
    <div class="main-content">
      <!-- 左侧对话区域 -->
      <div class="chat-section">
        <!-- 消息区域 -->
        <div class="chat-messages">
          <div v-if="historyLoaded && hasMoreHistory" class="load-more-history">
            <a-button type="link" :loading="isHistoryLoading" @click="loadHistory(true)">
              加载更多
            </a-button>
          </div>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message', msg.role]"
          >
            <div class="message-avatar">
              <a-avatar v-if="msg.role === 'user'" :size="32">
                <template #icon><UserOutlined /></template>
              </a-avatar>
              <a-avatar v-else :size="32" :src="aiAvatar" />
            </div>
            <div class="message-content">
              <div
                v-if="msg.role === 'assistant'"
                class="message-text markdown-body"
                v-html="msg.html || renderMarkdown(msg.content)"
              />
              <div v-else class="message-text">{{ msg.content }}</div>
              <div v-if="msg.createTime" class="message-time">
                {{ formatMessageTime(msg.createTime) }}
              </div>
            </div>
          </div>

          <!-- 流式消息 -->
          <div v-if="isStreaming && currentStreamingMessage" class="message assistant">
            <div class="message-avatar">
              <a-avatar :size="32" :src="aiAvatar" />
            </div>
            <div class="message-content">
              <pre class="message-text streaming-text">{{ currentStreamingMessage }}</pre>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="isLoading && !isStreaming" class="message assistant">
            <div class="message-avatar">
              <a-avatar :size="32" :src="aiAvatar" />
            </div>
            <div class="message-content">
              <div class="message-text">
                <a-spin size="small" />
                <span style="margin-left: 8px">思考中...</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="chat-input-area">
          <a-tooltip
            :title="canChat ? '' : '无法在别人的作品下对话哦~'"
            placement="top"
          >
          <div class="input-wrapper" :class="{ disabled: !canChat }">
            <a-textarea
              v-model:value="userInput"
              placeholder="请描述你想生成的网站，越详细效果越好哦"
              :auto-size="{ minRows: 1, maxRows: 4 }"
              @keypress="handleKeyPress"
              :disabled="isLoading || !canChat"
            />
            <div class="input-actions">
              <div class="action-buttons">
                <a-button type="text" size="small" :disabled="!canChat">
                  <template #icon><PaperClipOutlined /></template>
                </a-button>
                <a-button type="text" size="small" :disabled="!canChat">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </div>
              <a-button
                type="primary"
                shape="circle"
                :disabled="!userInput.trim() || isLoading || !canChat"
                @click="sendMessage(userInput)"
              >
                <template #icon><SendOutlined /></template>
              </a-button>
            </div>
          </div>
          </a-tooltip>
        </div>
      </div>

      <!-- 右侧网页展示区域 -->
      <div class="preview-section">
        <div v-if="previewStatus === 'ready'" class="preview-container">
          <iframe
            :key="previewFrameKey"
            :src="previewUrl"
            class="preview-iframe"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
        <div v-else-if="previewStatus === 'loading'" class="preview-placeholder">
          <a-spin size="large" />
          <p class="preview-status-text">正在加载生成页面...</p>
        </div>
        <div v-else-if="previewStatus === 'error'" class="preview-placeholder">
          <a-empty description="生成页面暂时无法加载">
            <a-button type="primary" @click="loadGeneratedPreview">重新加载</a-button>
          </a-empty>
        </div>
        <div v-else class="preview-placeholder">
          <a-empty description="AI 生成完成后将在此展示网页效果" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
}

.deploy-success-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 8px;
  text-align: center;
}

.deploy-success-icon {
  color: #52c41a;
  font-size: 64px;
}

.deploy-success-title {
  margin: 22px 0 14px;
  color: #1f2933;
  font-size: 22px;
  font-weight: 600;
}

.deploy-success-desc {
  margin: 0 0 26px;
  color: #666;
  font-size: 16px;
}

.deploy-url-box {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0 10px 0 16px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background: #fff;
}

.deploy-url-text {
  flex: 1;
  min-width: 0;
  color: #1f2933;
  font-size: 16px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-url-button {
  flex-shrink: 0;
}

.deploy-success-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}

.main-content {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.chat-section {
  flex: 0 0 50%;
  max-width: 50%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e8e8e8;
  background: #fff;
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
}

.load-more-history {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.message {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  align-items: start;
  column-gap: 10px;
  margin-bottom: 16px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.message.user {
  margin-left: 0;
}

.message-avatar {
  grid-column: 1;
  flex-shrink: 0;
}

.message-content {
  grid-column: 2;
  max-width: 100%;
  min-width: 0;
  background: white;
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  overflow-wrap: anywhere;
}

.message.user .message-avatar {
  grid-column: 3;
}

.message.user .message-content {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  width: fit-content;
  max-width: 100%;
}

.message.user .message-content {
  background: #1677ff;
  color: white;
}

.message-text {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  margin-top: 8px;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1;
  text-align: left;
}

.message.user .message-time {
  color: rgba(255, 255, 255, 0.72);
  text-align: right;
}

.streaming-text {
  max-height: 420px;
  max-width: min(720px, 100%);
  margin: 0;
  overflow-y: auto;
  overflow-x: hidden;
  color: #1f2933;
  font-size: 13px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f6f8fa;
}

.markdown-body {
  color: #1f2933;
  white-space: normal;
}

.markdown-body :deep(*) {
  letter-spacing: 0;
}

.markdown-body :deep(p) {
  margin: 0 0 10px;
}

.markdown-body :deep(p:last-child),
.markdown-body :deep(ul:last-child),
.markdown-body :deep(ol:last-child),
.markdown-body :deep(pre:last-child),
.markdown-body :deep(blockquote:last-child),
.markdown-body :deep(table:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px;
  color: #111827;
  font-weight: 600;
  line-height: 1.35;
}

.markdown-body :deep(h1) {
  font-size: 20px;
}

.markdown-body :deep(h2) {
  font-size: 18px;
}

.markdown-body :deep(h3) {
  font-size: 16px;
}

.markdown-body :deep(h4) {
  font-size: 15px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 12px;
  padding-left: 22px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 12px;
  color: #4b5563;
  background: #f8fafc;
  border-left: 4px solid #91caff;
}

.markdown-body :deep(a) {
  color: #1677ff;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  color: #c41d7f;
  font-size: 13px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f6f8fa;
  border-radius: 4px;
}

.markdown-body :deep(pre) {
  margin: 12px 0;
  padding: 14px 16px;
  max-width: 100%;
  overflow-x: hidden;
  white-space: pre-wrap;
  background: #f6f8fa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.markdown-body :deep(pre code) {
  display: block;
  padding: 0;
  color: inherit;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  background: transparent;
  border-radius: 0;
}

.markdown-body :deep(table) {
  display: block;
  width: 100%;
  margin: 12px 0;
  overflow-x: auto;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
}

.markdown-body :deep(th) {
  font-weight: 600;
  background: #f8fafc;
}

.markdown-body :deep(hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

.markdown-body.streaming {
  padding-right: 8px;
}

.message-text.streaming {
  border-right: 2px solid #1677ff;
  animation: blink 0.7s infinite;
}

@keyframes blink {
  0%, 50% { border-color: #1677ff; }
  51%, 100% { border-color: transparent; }
}

.chat-input-area {
  flex-shrink: 0;
  padding: 12px 16px 16px;
  background: white;
  border-top: 1px solid #e8e8e8;
}

.input-wrapper {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 10px;
  width: 100%;
}

.input-wrapper.disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.input-wrapper :deep(.ant-input) {
  background: transparent;
  border: none;
  box-shadow: none;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.preview-section {
  flex: 1 1 50%;
  min-width: 0;
  background: white;
  display: flex;
  flex-direction: column;
}

.preview-container {
  flex: 1;
  position: relative;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.preview-status-text {
  margin: 16px 0 0;
  color: #8c8c8c;
  font-size: 15px;
}

.preview-placeholder :deep(.ant-empty-description) {
  color: #8c8c8c;
  font-size: 15px;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .chat-section {
    max-width: none;
    border-right: none;
    border-bottom: 1px solid #e8e8e8;
    height: 50%;
  }

  .preview-section {
    width: 100%;
    height: 50%;
  }

  .message {
    max-width: 90%;
  }

  .chat-input-area {
    padding: 10px 12px 12px;
  }

  .deploy-success-panel {
    padding: 20px 8px 4px;
  }

  .deploy-success-title {
    font-size: 20px;
  }

  .deploy-success-desc {
    font-size: 14px;
  }
}
</style>
