<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, nextTick, computed, watch } from 'vue'
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
  PauseCircleOutlined,
  RocketOutlined,
  PaperClipOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
} from '@ant-design/icons-vue'
import {
  getAppById,
  getAppVoById,
  startGenerationTask,
  deployApp,
  deleteApp,
  adminDeleteApp,
  download as downloadAppCode,
  stopChatToGenCode,
} from '@/api/appController'
import {
  listAppChatHistoryByPage,
  listChatHistoryByPage,
} from '@/api/chatHistoryController'
import { getUserVoById } from '@/api/userController'
import { useLoginUserStore } from '@/stores/loginUser'
import ACCESS_ENUM from '@/access/accessEnum'
import aiAvatar from '@/assets/aiAvatar.png'
import AppDetailModal from '@/components/AppDetailModal.vue'
import { CODE_GEN_TYPE_ENUM, getCodeGenTypeLabel } from '@/constants/codeGenType'
import {
  isVisualEditorElementMessage,
  VisualEditorController,
  type VisualEditorElementInfo,
} from '@/utils/visualEditor'
import { getAvatarStyle, getAvatarText } from '@/utils/avatar'

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
const pendingPromptStoragePrefix = 'app-chat-pending-prompt:'
const generationTaskStoragePrefix = 'app-chat-generation-task:'
const generationCursorStoragePrefix = 'app-chat-generation-cursor:'

const createApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(`${apiBaseUrl}${normalizedPath}`, window.location.origin)
}

// 应用信息
const appInfo = ref<API.App | API.AppVO>({})
const creatorInfo = ref<API.UserVO>({})

type WorkflowEventType =
  | 'workflow_start'
  | 'step_completed'
  | 'workflow_completed'
  | 'workflow_error'

type WorkflowEventPayload = {
  originalPrompt?: string
  message?: string
  stepNumber?: number
  currentStep?: string
  error?: string
}

type WorkflowSseEvent = {
  eventName: WorkflowEventType
  data: WorkflowEventPayload
}

type BusinessErrorPayload = {
  message?: string
}

type WorkflowTimelineStep = {
  stepNumber: number
  title: string
}

type WorkflowTimeline = {
  status: 'running' | 'completed' | 'error' | 'stopped'
  originalPrompt?: string
  message?: string
  completedMessage?: string
  error?: string
  steps: WorkflowTimelineStep[]
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  createTime?: string
  html?: string
  workflow?: WorkflowTimeline
  workflowEvents?: WorkflowSseEvent[]
  workflowGroupKey?: string
}

// 对话相关
const messages = ref<ChatMessage[]>([])
const userInput = ref('')
const isLoading = ref(false)
const isStreaming = ref(false)
const isStopping = ref(false)
const isHistoryLoading = ref(false)
const hasMoreHistory = ref(false)
const historyTotal = ref(0)
const historyLoaded = ref(false)
const historyCursor = ref<string>()
const currentStreamingMessage = ref('')
const currentWorkflowTimeline = ref<WorkflowTimeline>()
let streamingDraft = ''
let streamingWorkflowEvents: WorkflowSseEvent[] = []
let streamingFlushTimer: number | undefined
let streamingPaintPending = false
const currentStreamRequestId = ref('')
let currentStreamAbortController: AbortController | undefined
let currentStreamStopRequested = false
let isPageUnmounting = false

// 网页预览相关
const previewIframeRef = ref<HTMLIFrameElement>()
const previewUrl = ref('')
const previewStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const previewFrameKey = ref(0)
let currentPreviewSignature = ''
let previewRefreshPromise: Promise<boolean> | undefined
let previewRefreshSeq = 0
const isVisualEditMode = ref(false)
const selectedElementInfo = ref<VisualEditorElementInfo>()
const isDeploying = ref(false)
const isDownloading = ref(false)
const detailModalOpen = ref(false)
const deploySuccessModalOpen = ref(false)
const deployedUrl = ref('')
const codeGenTypeLabel = computed(() => getCodeGenTypeLabel(appInfo.value.codeGenType))

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

const workflowEventNames = new Set<WorkflowEventType>([
  'workflow_start',
  'step_completed',
  'workflow_completed',
  'workflow_error',
])

const isWorkflowEventName = (eventName?: string): eventName is WorkflowEventType => {
  return workflowEventNames.has(eventName as WorkflowEventType)
}

const createWorkflowTimeline = (): WorkflowTimeline => ({
  status: 'running',
  steps: [],
})

const parseWorkflowSseEvent = (
  eventName: string | undefined,
  rawData: string,
): WorkflowSseEvent | undefined => {
  if (!isWorkflowEventName(eventName) || !rawData) {
    return undefined
  }

  try {
    const data = JSON.parse(rawData) as WorkflowEventPayload
    return { eventName, data }
  } catch {
    return {
      eventName,
      data: {
        message: rawData,
      },
    }
  }
}

const applyWorkflowEvent = (timeline: WorkflowTimeline, workflowEvent: WorkflowSseEvent) => {
  const { eventName, data } = workflowEvent

  if (eventName === 'workflow_start') {
    timeline.status = 'running'
    timeline.originalPrompt = data.originalPrompt || timeline.originalPrompt
    timeline.message = data.message || '开始执行代码生成工作流'
    return
  }

  if (eventName === 'step_completed') {
    const stepNumber = Number(data.stepNumber || timeline.steps.length + 1)
    const title = data.currentStep || `第 ${stepNumber} 步`
    const existingStep = timeline.steps.find((step) => step.stepNumber === stepNumber)
    if (existingStep) {
      existingStep.title = title
      return
    }
    timeline.steps.push({ stepNumber, title })
    timeline.steps.sort((left, right) => left.stepNumber - right.stepNumber)
    return
  }

  if (eventName === 'workflow_completed') {
    timeline.status = 'completed'
    timeline.completedMessage = data.message || '代码生成工作流执行完成'
    return
  }

  timeline.status = 'error'
  timeline.error = data.error || data.message || '工作流执行失败'
}

const parseWorkflowEventsFromContent = (content: string) => {
  const workflowEvents: WorkflowSseEvent[] = []
  let eventName = ''
  let dataLines: string[] = []

  const commitEvent = () => {
    if (!dataLines.length) {
      return
    }
    const workflowEvent = parseWorkflowSseEvent(eventName, dataLines.join('\n'))
    if (workflowEvent) {
      workflowEvents.push(workflowEvent)
    }
    eventName = ''
    dataLines = []
  }

  content.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) {
      commitEvent()
      return
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      return
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  })
  commitEvent()

  return workflowEvents
}

const buildWorkflowTimeline = (workflowEvents: WorkflowSseEvent[]) => {
  const timeline = createWorkflowTimeline()
  workflowEvents.forEach((workflowEvent) => {
    applyWorkflowEvent(timeline, workflowEvent)
  })
  return timeline
}

const getWorkflowStatusText = (workflow?: WorkflowTimeline) => {
  if (!workflow) return ''
  if (workflow.status === 'completed') return '已完成'
  if (workflow.status === 'error') return '失败'
  if (workflow.status === 'stopped') return '已暂停'
  return '进行中'
}

const getWorkflowTagColor = (workflow?: WorkflowTimeline) => {
  if (!workflow) return 'default'
  if (workflow.status === 'completed') return 'success'
  if (workflow.status === 'error') return 'error'
  if (workflow.status === 'stopped') return 'warning'
  return 'processing'
}

const getWorkflowTitle = (workflow?: WorkflowTimeline) => {
  if (!workflow) return ''
  if (workflow.status === 'completed') return workflow.completedMessage || '工作流执行完成'
  if (workflow.status === 'error') return workflow.error || '工作流执行失败'
  if (workflow.status === 'stopped') return '已暂停生成'
  return workflow.message || '代码生成工作流执行中'
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
  const workflowEvents = role === 'assistant' ? parseWorkflowEventsFromContent(content) : []
  if (workflowEvents.length) {
    return {
      role,
      content,
      createTime: history.createTime,
      workflow: buildWorkflowTimeline(workflowEvents),
      workflowEvents,
      workflowGroupKey: history.parentId,
    }
  }

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

const compactWorkflowMessages = (chatMessages: ChatMessage[]) => {
  return chatMessages.reduce<ChatMessage[]>((mergedMessages, chatMessage) => {
    if (!chatMessage.workflow || !chatMessage.workflowEvents?.length) {
      mergedMessages.push(chatMessage)
      return mergedMessages
    }

    const previousMessage = mergedMessages[mergedMessages.length - 1]
    const isSameWorkflow =
      previousMessage?.workflow &&
      previousMessage.workflowEvents &&
      (!previousMessage.workflowGroupKey ||
        !chatMessage.workflowGroupKey ||
        previousMessage.workflowGroupKey === chatMessage.workflowGroupKey)

    if (!isSameWorkflow) {
      mergedMessages.push(chatMessage)
      return mergedMessages
    }

    chatMessage.workflowEvents.forEach((workflowEvent) => {
      applyWorkflowEvent(previousMessage.workflow!, workflowEvent)
      previousMessage.workflowEvents!.push(workflowEvent)
    })
    previousMessage.content = [previousMessage.content, chatMessage.content].filter(Boolean).join('\n')
    previousMessage.createTime = chatMessage.createTime || previousMessage.createTime
    return mergedMessages
  }, [])
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
    return listChatHistoryByPage(body)
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
  const baseUrl = createApiUrl(`/static/${appInfo.value.codeGenType}_${appId.value}/`).toString()
  return appInfo.value.codeGenType === CODE_GEN_TYPE_ENUM.VUE_PROJECT
    ? `${baseUrl}dist/index.html` : baseUrl
}

const isVueProjectPreview = () => appInfo.value.codeGenType === CODE_GEN_TYPE_ENUM.VUE_PROJECT

let visualEditorController: VisualEditorController | undefined

const formatSelectedElementInfo = (elementInfo: VisualEditorElementInfo) => {
  const segments = [
    elementInfo.pagePath ? `页面路径：${elementInfo.pagePath}` : '',
    `标签：${elementInfo.tagName}`,
    elementInfo.id ? `ID：${elementInfo.id}` : '',
    elementInfo.className ? `类名：${elementInfo.className}` : '',
    elementInfo.text ? `文本：${elementInfo.text}` : '',
    `选择器：${elementInfo.selector}`,
  ].filter(Boolean)
  return segments.join('；')
}

const buildPromptWithSelectedElement = (content: string) => {
  if (!selectedElementInfo.value) {
    return content
  }

  return `${content}

请基于我在预览页面中选中的元素进行修改。
选中元素信息：${formatSelectedElementInfo(selectedElementInfo.value)}`
}

const clearSelectedElement = () => {
  selectedElementInfo.value = undefined
  visualEditorController?.clearSelection()
}

const exitVisualEditMode = () => {
  isVisualEditMode.value = false
  clearSelectedElement()
  visualEditorController?.disable()
}

const setupVisualEditor = async () => {
  await nextTick()
  if (!previewIframeRef.value || previewStatus.value !== 'ready') {
    return false
  }
  visualEditorController?.destroy()
  visualEditorController = new VisualEditorController(previewIframeRef.value)
  if (isVisualEditMode.value) {
    return visualEditorController.enable()
  }
  return true
}

const toggleVisualEditMode = async () => {
  if (!canChat.value || previewStatus.value !== 'ready') {
    message.warning('请先等待网页预览加载完成')
    return
  }

  if (isVisualEditMode.value) {
    exitVisualEditMode()
    return
  }

  isVisualEditMode.value = true
  const enabled = await setupVisualEditor()
  if (!enabled) {
    isVisualEditMode.value = false
    message.warning('当前预览页面无法进入可视化编辑，请确认预览与主站同源')
  }
}

const handleVisualEditorMessage = (event: MessageEvent) => {
  if (!isVisualEditorElementMessage(event)) {
    return
  }
  selectedElementInfo.value = event.data.payload
}

const sleep = (ms: number) => {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

const resetStreamingContent = () => {
  streamingDraft = ''
  streamingWorkflowEvents = []
  currentStreamingMessage.value = ''
  currentWorkflowTimeline.value = undefined
  if (streamingFlushTimer) {
    window.clearTimeout(streamingFlushTimer)
    streamingFlushTimer = undefined
  }
  streamingPaintPending = false
}

const flushStreamingContent = async () => {
  streamingFlushTimer = undefined
  currentStreamingMessage.value = streamingDraft
  await nextTick()
  scrollToBottom()
}

const scheduleStreamingPaint = () => {
  if (streamingPaintPending) {
    return
  }

  streamingPaintPending = true
  void nextTick().then(() => {
    window.requestAnimationFrame(() => {
      streamingPaintPending = false
      currentStreamingMessage.value = streamingDraft
      scrollToBottom()
    })
  })
}

const appendStreamingContent = (text: string) => {
  streamingDraft += text
  currentStreamingMessage.value = streamingDraft
  scheduleStreamingPaint()
  if (streamingFlushTimer) {
    return
  }

  streamingFlushTimer = window.setTimeout(() => {
    flushStreamingContent()
  }, 120)
}

const appendWorkflowStreamingEvent = async (workflowEvent: WorkflowSseEvent) => {
  if (!currentWorkflowTimeline.value || workflowEvent.eventName === 'workflow_start') {
    currentWorkflowTimeline.value = createWorkflowTimeline()
  }
  applyWorkflowEvent(currentWorkflowTimeline.value, workflowEvent)
  streamingWorkflowEvents.push(workflowEvent)
  await nextTick()
  scrollToBottom()
}

const getGenerationTaskStorageKey = (id = appId.value) => {
  return `${generationTaskStoragePrefix}${id}`
}

const getGenerationCursorStorageKey = (id = appId.value) => {
  return `${generationCursorStoragePrefix}${id}`
}

const getStoredGenerationRequestId = () => {
  if (!appId.value) {
    return ''
  }
  return localStorage.getItem(getGenerationTaskStorageKey()) || ''
}

const getStoredGenerationCursor = () => {
  if (!appId.value) {
    return 0
  }
  const cursor = Number(localStorage.getItem(getGenerationCursorStorageKey()) || 0)
  return Number.isFinite(cursor) && cursor > 0 ? cursor : 0
}

const saveGenerationTask = (requestId: string) => {
  localStorage.setItem(getGenerationTaskStorageKey(), requestId)
  localStorage.setItem(getGenerationCursorStorageKey(), '0')
}

const saveGenerationCursor = (cursor: number) => {
  if (!appId.value || !Number.isFinite(cursor) || cursor <= 0) {
    return
  }
  localStorage.setItem(getGenerationCursorStorageKey(), String(cursor))
}

const clearGenerationTask = (requestId?: string) => {
  if (!appId.value) {
    return
  }
  const storedRequestId = getStoredGenerationRequestId()
  if (!requestId || !storedRequestId || storedRequestId === requestId) {
    localStorage.removeItem(getGenerationTaskStorageKey())
    localStorage.removeItem(getGenerationCursorStorageKey())
  }
}

const keepStoppedStreamingContent = () => {
  if (currentWorkflowTimeline.value && streamingWorkflowEvents.length) {
    currentWorkflowTimeline.value.status = 'stopped'
    messages.value.push({
      role: 'assistant',
      content: streamingWorkflowEvents
        .map((workflowEvent) => `event:${workflowEvent.eventName}\ndata:${JSON.stringify(workflowEvent.data)}`)
        .join('\n\n'),
      createTime: new Date().toISOString(),
      workflow: currentWorkflowTimeline.value,
      workflowEvents: [...streamingWorkflowEvents],
    })
    resetStreamingContent()
    return
  }

  const content = currentStreamingMessage.value || streamingDraft
  if (!content) {
    return
  }

  messages.value.push({
    role: 'assistant',
    content,
    createTime: new Date().toISOString(),
    html: renderMarkdown(content),
  })
  resetStreamingContent()
}

// 暂停当前 AI 回复：通知后端停止对应 requestId，并关闭浏览器端 SSE 读取。
const stopGenerating = async () => {
  if (!currentStreamRequestId.value || !appId.value || isStopping.value) {
    return
  }

  const requestId = currentStreamRequestId.value
  currentStreamStopRequested = true
  isStopping.value = true

  try {
    await stopChatToGenCode({
      appId: appId.value,
      requestId,
    })
  } catch (error) {
    message.warning('暂停请求可能未送达服务端')
    console.error('Stop stream error:', error)
  } finally {
    clearGenerationTask(requestId)
    keepStoppedStreamingContent()
    currentStreamAbortController?.abort()
    isLoading.value = false
    isStreaming.value = false
    isStopping.value = false
  }
}
type PreviewReadyResult = {
  ready: boolean
  signature?: string
}

type LoadPreviewOptions = {
  showLoading?: boolean
}

let previewLoadSeq = 0

const hashPreviewContent = (content: string) => {
  let hash = 0
  for (let index = 0; index < content.length; index += 1) {
    hash = Math.imul(31, hash) + content.charCodeAt(index)
    hash |= 0
  }
  return `${content.length}:${hash}`
}

const collectPreviewAssetUrls = (html: string, baseUrl: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const previewUrlObject = new URL(baseUrl)
  const assetElements = Array.from(
    doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]',
    ),
  )

  return assetElements
    .map((element) => element.getAttribute('src') || element.getAttribute('href'))
    .filter((assetUrl): assetUrl is string => !!assetUrl && !assetUrl.startsWith('data:'))
    .map((assetUrl) => new URL(assetUrl, baseUrl))
    .filter((assetUrl) => assetUrl.origin === previewUrlObject.origin)
    .map((assetUrl) => assetUrl.toString())
}

const checkAssetReady = async (url: string, signal: AbortSignal) => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal,
    })
    return response.ok
  } catch {
    return false
  }
}

// 检查预览是否准备就绪。Vue 项目需要等新 dist/index.html 和其引用资源都落盘。
const checkPreviewReady = async (url: string, previousSignature = ''): Promise<PreviewReadyResult> => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      return { ready: false }
    }
    if (!isVueProjectPreview()) {
      return { ready: true }
    }

    const html = await response.text()
    const signature = hashPreviewContent(html)
    if (previousSignature && signature === previousSignature) {
      return { ready: false, signature }
    }

    const assetUrls = collectPreviewAssetUrls(html, url)
    const assetsReady = await Promise.all(
      assetUrls.map((assetUrl) => checkAssetReady(assetUrl, controller.signal)),
    )
    return {
      ready: assetsReady.every(Boolean),
      signature,
    }
  } catch {
    return { ready: false }
  } finally {
    window.clearTimeout(timer)
  }
}
// 加载生成的预览
const normalizeLoadPreviewOptions = (
  options: boolean | LoadPreviewOptions = {},
): Required<LoadPreviewOptions> => {
  if (typeof options === 'boolean') {
    return {
      showLoading: true,
    }
  }

  return {
    showLoading: options.showLoading ?? true,
  }
}

const loadGeneratedPreview = async (options: boolean | LoadPreviewOptions = {}) => {
  //
  if (!appInfo.value.codeGenType) {
    return false
  }

  const loadSeq = ++previewLoadSeq
  const url = getGeneratedPreviewUrl()
  const { showLoading } = normalizeLoadPreviewOptions(options)
  const shouldShowLoading = showLoading || !previewUrl.value
  const previousStatus = previewStatus.value
  if (shouldShowLoading) {
    previewStatus.value = 'loading'
  }
  const maxAttempts = isVueProjectPreview() ? 45 : 10

  for (let index = 0; index < maxAttempts; index += 1) {
    if (loadSeq !== previewLoadSeq) {
      return false
    }
    const result = await checkPreviewReady(url)
    if (result.ready) {
      if (loadSeq !== previewLoadSeq) {
        return false
      }
      currentPreviewSignature = result.signature || currentPreviewSignature
      previewUrl.value = `${url}?t=${Date.now()}`
      previewFrameKey.value += 1
      previewStatus.value = 'ready'
      return true
    }
    await sleep(isVueProjectPreview() ? 1000 : 600)
  }

  if (loadSeq === previewLoadSeq) {
    previewStatus.value = shouldShowLoading ? 'error' : previousStatus
  }
  return false
}

const restoreGeneratedPreview = async () => {
  if (!appInfo.value.codeGenType) {
    return false
  }

  const result = await checkPreviewReady(getGeneratedPreviewUrl())
  if (!result.ready) {
    return false
  }

  currentPreviewSignature = result.signature || currentPreviewSignature
  previewUrl.value = `${getGeneratedPreviewUrl()}?t=${Date.now()}`
  previewFrameKey.value += 1
  previewStatus.value = 'ready'
  return true
}

const isBuildCompleted = (app?: API.App | API.AppVO) => {
  return app?.isBuilderComplete === true
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
    if (parsed?.type === 'tool_request') {
      const toolName = parsed.name || '工具'
      return `\n\n[工具调用] ${toolName}\n`
    }
    if (parsed?.type === 'tool_executed') {
      return parsed.result || parsed.data || ''
    }
    return parsed?.d ?? parsed?.data ?? parsed?.content ?? parsed?.text ?? ''
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
      const historyMessages = compactWorkflowMessages(records.map(toChatMessage))
      messages.value = compactWorkflowMessages(
        loadMore ? [...historyMessages, ...messages.value] : historyMessages,
      )
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

    const activeRequestId = getStoredGenerationRequestId()
    if (activeRequestId) {
      await resumeGenerationTask(activeRequestId)
      return
    }

    const pendingPrompt = consumePendingPrompt()
    const autoPrompt = pendingPrompt || appInfo.value.initPrompt || ''
    if (autoPrompt && canChat.value && messages.value.length === 0) {
      await sendMessage(autoPrompt)
    }
  }
}

const refreshAppInfoForPreview = async (options: boolean | LoadPreviewOptions = {}) => {
  if (!appId.value) return false
  const refreshSeq = ++previewRefreshSeq
  const loadPreviewOptions = normalizeLoadPreviewOptions(options)
  const shouldShowLoading = loadPreviewOptions.showLoading || !previewUrl.value
  const previousStatus = previewStatus.value

  if (shouldShowLoading) {
    previewStatus.value = 'loading'
  }

  for (let index = 0; index < 45; index += 1) {
    if (refreshSeq !== previewRefreshSeq) {
      return false
    }
    const res = await fetchCurrentAppInfo()
    if (res.data.code === 0 && res.data.data) {
      appInfo.value = res.data.data

      if (appInfo.value.codeGenType && isBuildCompleted(appInfo.value)) {
        return loadGeneratedPreview(loadPreviewOptions)
      }
    }
    await sleep(1000)
  }

  if (shouldShowLoading) {
    previewStatus.value = previewUrl.value ? previousStatus : 'error'
  }
  return false
}

const refreshPreviewInBackground = (refreshTask: () => Promise<boolean>) => {
  if (previewRefreshPromise) {
    return
  }
  previewRefreshPromise = refreshTask()
  void previewRefreshPromise.catch((error) => {
    console.error('Refresh preview error:', error)
    if (!previewUrl.value) {
      previewStatus.value = 'error'
    }
  }).finally(() => {
    previewRefreshPromise = undefined
  })
}

const createPreviewRefreshAfterAiReplyTask = () => {
  return () => refreshAppInfoForPreview({ showLoading: !previewUrl.value })
}

type GenerationStreamStatus = 'done' | 'error' | 'stopped' | 'disconnected'

const parseGenerationEventContent = async (eventName: string, rawData: string) => {
  const workflowEvents = parseWorkflowEventsFromContent(rawData)
  if (workflowEvents.length) {
    for (const workflowEvent of workflowEvents) {
      await appendWorkflowStreamingEvent(workflowEvent)
    }
    return
  }

  const text = getSseMessageContent(rawData)
  const nestedWorkflowEvents = parseWorkflowEventsFromContent(text)
  if (nestedWorkflowEvents.length) {
    for (const workflowEvent of nestedWorkflowEvents) {
      await appendWorkflowStreamingEvent(workflowEvent)
    }
    return
  }

  if (text && eventName !== 'workflow_step') {
    appendStreamingContent(text)
  }
}

const handleGenerationErrorEvent = (rawData: string) => {
  let errorMessage = '生成过程中出现错误'
  try {
    const errorData = JSON.parse(rawData) as BusinessErrorPayload
    errorMessage = errorData.message || errorMessage
  } catch {
    if (rawData.trim()) {
      errorMessage = rawData
    }
  }

  streamingDraft = `❌ ${errorMessage}`
  streamingWorkflowEvents = []
  currentWorkflowTimeline.value = undefined
  currentStreamingMessage.value = streamingDraft
  message.error(errorMessage)
}

const commitStreamingMessage = () => {
  if (currentWorkflowTimeline.value && streamingWorkflowEvents.length) {
    if (currentStreamStopRequested) {
      currentWorkflowTimeline.value.status = 'stopped'
    }
    const shouldRefreshAppPreview = currentWorkflowTimeline.value.status === 'completed'
    messages.value.push({
      role: 'assistant',
      content: streamingWorkflowEvents
        .map((workflowEvent) => `event:${workflowEvent.eventName}\ndata:${JSON.stringify(workflowEvent.data)}`)
        .join('\n\n'),
      createTime: new Date().toISOString(),
      workflow: currentWorkflowTimeline.value,
      workflowEvents: [...streamingWorkflowEvents],
    })
    resetStreamingContent()
    return shouldRefreshAppPreview
  }

  if (streamingFlushTimer) {
    window.clearTimeout(streamingFlushTimer)
    streamingFlushTimer = undefined
  }
  currentStreamingMessage.value = streamingDraft
  if (!currentStreamingMessage.value) {
    return false
  }

  const content = currentStreamingMessage.value
  messages.value.push({
    role: 'assistant',
    content,
    createTime: new Date().toISOString(),
    html: renderMarkdown(content),
  })
  resetStreamingContent()
  return !currentStreamStopRequested && !content.startsWith('❌')
}

const consumeGenerationConnection = async (
  requestId: string,
): Promise<GenerationStreamStatus> => {
  const streamAbortController = new AbortController()
  currentStreamAbortController = streamAbortController
  const url = createApiUrl('/app/chat/gen/stream')
  url.searchParams.set('requestId', requestId)
  const lastEventId = getStoredGenerationCursor()

  const response = await fetch(url.toString(), {
    credentials: 'include',
    signal: streamAbortController.signal,
    headers: lastEventId > 0 ? { 'Last-Event-ID': String(lastEventId) } : undefined,
  })
  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'
  let currentEventId = ''
  let dataLines: string[] = []
  let terminalStatus: GenerationStreamStatus = 'disconnected'

  const resetEventFrame = () => {
    currentEvent = 'message'
    currentEventId = ''
    dataLines = []
  }

  const dispatchEventFrame = async () => {
    if (!dataLines.length && !currentEventId) {
      resetEventFrame()
      return
    }

    const rawData = dataLines.join('\n')
    const eventId = Number(currentEventId)
    if (Number.isFinite(eventId) && eventId > 0) {
      saveGenerationCursor(eventId)
    }

    if (currentEvent === 'done') {
      terminalStatus = 'done'
    } else if (currentEvent === 'stopped') {
      currentStreamStopRequested = true
      terminalStatus = 'stopped'
    } else if (currentEvent === 'error' || currentEvent === 'business-error') {
      handleGenerationErrorEvent(rawData)
      terminalStatus = 'error'
    } else {
      await parseGenerationEventContent(currentEvent, rawData)
    }

    resetEventFrame()
  }

  const processLine = async (line: string) => {
    if (!line || line.startsWith(':')) {
      if (!line) {
        await dispatchEventFrame()
      }
      return
    }
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim() || 'message'
      return
    }
    if (line.startsWith('id:')) {
      currentEventId = line.slice(3).trim()
      return
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''))
    }
  }

  try {
    while (!terminalStatus || terminalStatus === 'disconnected') {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        await processLine(line.replace(/\r$/, ''))
        if (terminalStatus !== 'disconnected') {
          break
        }
      }
      if (terminalStatus !== 'disconnected') {
        await reader.cancel().catch(() => undefined)
        break
      }
    }

    if (buffer) {
      // 服务端断开时，最后一个数据块不一定以空行结尾，需要把其中的每一行补处理完。
      const trailingLines = buffer.split(/\r?\n/)
      buffer = ''
      for (const line of trailingLines) {
        await processLine(line)
        if (terminalStatus !== 'disconnected') {
          break
        }
      }
    }
    if (dataLines.length || currentEventId) {
      await dispatchEventFrame()
    }
  } finally {
    if (currentStreamAbortController === streamAbortController) {
      currentStreamAbortController = undefined
    }
  }

  return terminalStatus
}

const consumeGenerationStream = async (requestId: string): Promise<GenerationStreamStatus> => {
  while (!isPageUnmounting && currentStreamRequestId.value === requestId) {
    try {
      const status = await consumeGenerationConnection(requestId)
      if (status !== 'disconnected') {
        return status
      }
    } catch (error) {
      if (currentStreamStopRequested || (error instanceof DOMException && error.name === 'AbortError')) {
        return currentStreamStopRequested ? 'stopped' : 'disconnected'
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('SSE request failed: 404')) {
        clearGenerationTask(requestId)
        return 'error'
      }
      console.warn('Generation SSE disconnected, retrying:', error)
    }

    if (!isPageUnmounting && !currentStreamStopRequested) {
      await sleep(1000)
    }
  }

  return currentStreamStopRequested ? 'stopped' : 'disconnected'
}

const runGenerationStream = async (requestId: string) => {
  let previewRefreshTask: (() => Promise<boolean>) | undefined
  try {
    const status = await consumeGenerationStream(requestId)
    if (status === 'disconnected' || isPageUnmounting) {
      return
    }

    if (status === 'stopped' && currentWorkflowTimeline.value) {
      currentWorkflowTimeline.value.status = 'stopped'
    }
    const shouldRefreshAppPreview = commitStreamingMessage()
    clearGenerationTask(requestId)

    if (shouldRefreshAppPreview) {
      previewRefreshTask = createPreviewRefreshAfterAiReplyTask()
    }
    await loadHistory()
  } catch (error) {
    if (!currentStreamStopRequested) {
      message.error('对话请求失败')
      console.error('Chat error:', error)
    }
  } finally {
    if (!isPageUnmounting) {
      isLoading.value = false
      isStreaming.value = false
      isStopping.value = false
      currentStreamAbortController = undefined
      if (currentStreamRequestId.value === requestId) {
        currentStreamRequestId.value = ''
      }
      currentStreamStopRequested = false
      if (previewRefreshTask) {
        refreshPreviewInBackground(previewRefreshTask)
      }
    }
  }
}

const resumeGenerationTask = async (requestId: string) => {
  if (!requestId || isLoading.value) {
    return false
  }

  isLoading.value = true
  isStreaming.value = true
  isStopping.value = false
  currentStreamStopRequested = false
  currentStreamRequestId.value = requestId
  resetStreamingContent()
  void runGenerationStream(requestId)
  return true
}

// 发送消息
const sendMessage = async (content: string) => {
  if (!canChat.value) {
    message.warning('无法在别人的作品下对话哦~')
    return
  }
  if (!content.trim() || isLoading.value) return
  const requestContent = buildPromptWithSelectedElement(content)

  messages.value.push({ role: 'user', content: requestContent, createTime: new Date().toISOString() })
  userInput.value = ''
  exitVisualEditMode()

  await nextTick()
  scrollToBottom()

  isLoading.value = true
  isStreaming.value = true
  isStopping.value = false
  currentStreamStopRequested = false
  resetStreamingContent()

  try {
    const res = await startGenerationTask({
      appId: appId.value,
      message: requestContent,
    })
    if (res.data.code !== 0 || !res.data.data) {
      throw new Error(res.data.message || '启动生成任务失败')
    }

    const requestId = res.data.data
    saveGenerationTask(requestId)
    currentStreamRequestId.value = requestId
    void runGenerationStream(requestId)
  } catch (error) {
    isLoading.value = false
    isStreaming.value = false
    currentStreamRequestId.value = ''
    message.error(error instanceof Error ? error.message : '启动生成任务失败')
    console.error('Start generation error:', error)
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

const normalizeZipFileName = (fileName: string) => {
  const trimmedFileName = fileName.trim().replace(/^["']|["']$/g, '')
  if (!trimmedFileName) {
    return 'app.zip'
  }
  return trimmedFileName.toLowerCase().endsWith('.zip') ? trimmedFileName : `${trimmedFileName}.zip`
}

const getDownloadFileName = (contentDisposition?: string) => {
  const fallbackName = normalizeZipFileName(appInfo.value.appName || `app-${appId.value}`)
  if (!contentDisposition) {
    return fallbackName
  }

  const encodedFileName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encodedFileName) {
    try {
      return normalizeZipFileName(decodeURIComponent(encodedFileName))
    } catch {
      return normalizeZipFileName(encodedFileName)
    }
  }

  const quotedFileName = contentDisposition.match(/filename="([^"]+)"/i)?.[1]
  if (quotedFileName) {
    return normalizeZipFileName(quotedFileName)
  }

  const fileName = contentDisposition.match(/filename=([^;]+)/i)?.[1]
  return fileName ? normalizeZipFileName(fileName) : fallbackName
}

const readBlobText = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

const getDownloadErrorMessage = async (blob: Blob) => {
  try {
    const text = await readBlobText(blob)
    if (!text) {
      return '下载代码失败'
    }
    const result = JSON.parse(text)
    return result?.message || '下载代码失败'
  } catch {
    return '下载代码失败'
  }
}

const handleDownloadCode = async () => {
  if (!appId.value || isDownloading.value) return
  isDownloading.value = true

  try {
    const res = await downloadAppCode(
      { appId: appId.value },
      {
        responseType: 'blob',
      },
    )
    const blob = res.data instanceof Blob
      ? res.data
      : new Blob([res.data], { type: 'application/zip' })
    const contentType = String(res.headers?.['content-type'] || blob.type || '').toLowerCase()
    const isZipResponse = contentType.includes('application/zip') || contentType.includes('application/octet-stream')
    if (res.status !== 200 || !isZipResponse) {
      message.error(await getDownloadErrorMessage(blob))
      return
    }
    const contentDisposition = res.headers?.['content-disposition']
    const fileName = getDownloadFileName(contentDisposition)
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
    message.success('下载已开始')
  } catch (error) {
    message.error('下载代码失败')
    console.error('Download code error:', error)
  } finally {
    isDownloading.value = false
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
  isPageUnmounting = false
  window.addEventListener('message', handleVisualEditorMessage)
  fetchAppInfo()
})

onBeforeUnmount(() => {
  isPageUnmounting = true
  currentStreamAbortController?.abort()
  previewRefreshSeq += 1
  window.removeEventListener('message', handleVisualEditorMessage)
  visualEditorController?.destroy()
})

watch(previewFrameKey, () => {
  clearSelectedElement()
  setupVisualEditor()
})

watch(previewStatus, (status) => {
  if (status !== 'ready') {
    exitVisualEditMode()
  }
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
        <a-tag v-if="appInfo.codeGenType" color="blue" class="app-code-type-tag">
          {{ codeGenTypeLabel }}
        </a-tag>
      </div>
      <div class="top-bar-right">
        <a-button @click="detailModalOpen = true">
          <template #icon><InfoCircleOutlined /></template>
          应用详情
        </a-button>
        <a-button
          @click="handleDownloadCode"
          :disabled="!appId"
          :loading="isDownloading"
        >
          <template #icon><DownloadOutlined /></template>
          下载代码
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
              <a-avatar
                v-if="msg.role === 'user'"
                :size="32"
                :style="getAvatarStyle(loginUserStore.loginUser.userName)"
                class="user-message-avatar"
              >
                {{ getAvatarText(loginUserStore.loginUser.userName) }}
              </a-avatar>
              <a-avatar v-else :size="32" :src="aiAvatar" />
            </div>
            <div class="message-content">
              <div v-if="msg.workflow" class="workflow-card">
                <div class="workflow-header">
                  <div>
                    <div class="workflow-title">{{ getWorkflowTitle(msg.workflow) }}</div>
                    <div v-if="msg.workflow.originalPrompt" class="workflow-prompt">
                      {{ msg.workflow.originalPrompt }}
                    </div>
                  </div>
                  <a-tag :color="getWorkflowTagColor(msg.workflow)">
                    {{ getWorkflowStatusText(msg.workflow) }}
                  </a-tag>
                </div>
                <div class="workflow-steps">
                  <div
                    v-for="step in msg.workflow.steps"
                    :key="step.stepNumber"
                    class="workflow-step completed"
                  >
                    <div class="workflow-step-marker">
                      <CheckCircleOutlined />
                    </div>
                    <div class="workflow-step-body">
                      <span class="workflow-step-number">第 {{ step.stepNumber }} 步</span>
                      <span class="workflow-step-title">{{ step.title }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="msg.workflow.error" class="workflow-error">
                  {{ msg.workflow.error }}
                </div>
              </div>
              <div
                v-else-if="msg.role === 'assistant'"
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

          <div v-if="isStreaming && currentWorkflowTimeline" class="message assistant">
            <div class="message-avatar">
              <a-avatar :size="32" :src="aiAvatar" />
            </div>
            <div class="message-content">
              <div class="workflow-card streaming-workflow">
                <div class="workflow-header">
                  <div>
                    <div class="workflow-title">{{ getWorkflowTitle(currentWorkflowTimeline) }}</div>
                    <div v-if="currentWorkflowTimeline.originalPrompt" class="workflow-prompt">
                      {{ currentWorkflowTimeline.originalPrompt }}
                    </div>
                  </div>
                  <a-tag :color="getWorkflowTagColor(currentWorkflowTimeline)">
                    {{ getWorkflowStatusText(currentWorkflowTimeline) }}
                  </a-tag>
                </div>
                <div class="workflow-steps">
                  <div
                    v-for="step in currentWorkflowTimeline.steps"
                    :key="step.stepNumber"
                    class="workflow-step completed"
                  >
                    <div class="workflow-step-marker">
                      <CheckCircleOutlined />
                    </div>
                    <div class="workflow-step-body">
                      <span class="workflow-step-number">第 {{ step.stepNumber }} 步</span>
                      <span class="workflow-step-title">{{ step.title }}</span>
                    </div>
                  </div>
                  <div v-if="currentWorkflowTimeline.status === 'running'" class="workflow-step running">
                    <div class="workflow-step-marker">
                      <a-spin size="small" />
                    </div>
                    <div class="workflow-step-body">
                      <span class="workflow-step-title">正在推进下一步...</span>
                    </div>
                  </div>
                </div>
                <div v-if="currentWorkflowTimeline.error" class="workflow-error">
                  {{ currentWorkflowTimeline.error }}
                </div>
              </div>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="isLoading && !isStreaming && !currentWorkflowTimeline" class="message assistant">
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
          <a-alert
            v-if="selectedElementInfo"
            class="selected-element-alert"
            type="info"
            show-icon
            closable
            :message="`已选择元素：${selectedElementInfo.tagName}`"
            :description="formatSelectedElementInfo(selectedElementInfo)"
            @close="clearSelectedElement"
          />
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
                <a-button type="text" size="small" disabled>
                  <template #icon><PaperClipOutlined /></template>
                </a-button>
              </div>
              <div class="send-actions">
                <a-button
                  :type="isVisualEditMode ? 'primary' : 'text'"
                  size="small"
                  :disabled="isLoading || !canChat || previewStatus !== 'ready'"
                  @click="toggleVisualEditMode"
                >
                  <template #icon><EditOutlined /></template>
                  {{ isVisualEditMode ? '退出编辑' : '编辑模式' }}
                </a-button>
                <a-button
                  v-if="isLoading"
                  danger
                  shape="circle"
                  :loading="isStopping"
                  :disabled="!canChat"
                  @click="stopGenerating"
                >
                  <template #icon><PauseCircleOutlined /></template>
                </a-button>
                <a-button
                  v-else
                  type="primary"
                  shape="circle"
                  :disabled="!userInput.trim() || !canChat"
                  @click="sendMessage(userInput)"
                >
                  <template #icon><SendOutlined /></template>
                </a-button>
              </div>
            </div>
          </div>
          </a-tooltip>
        </div>
      </div>

      <!-- 右侧网页展示区域 -->
      <div class="preview-section">
        <div v-if="previewStatus === 'ready'" class="preview-container">
          <iframe
            ref="previewIframeRef"
            :key="previewFrameKey"
            :src="previewUrl"
            class="preview-iframe"
            sandbox="allow-scripts allow-same-origin"
            @load="setupVisualEditor"
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
  min-width: 0;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-title {
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-code-type-tag {
  flex-shrink: 0;
  margin-inline-end: 0;
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

.user-message-avatar {
  font-weight: 500;
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

.workflow-card {
  min-width: min(420px, 100%);
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eef2f7;
}

.workflow-title {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
}

.workflow-prompt {
  display: -webkit-box;
  margin-top: 4px;
  max-width: 520px;
  overflow: hidden;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.workflow-steps {
  margin-top: 12px;
}

.workflow-step {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  padding-bottom: 12px;
}

.workflow-step:last-child {
  padding-bottom: 0;
}

.workflow-step::before {
  position: absolute;
  top: 24px;
  bottom: 0;
  left: 11px;
  width: 1px;
  background: #dbeafe;
  content: '';
}

.workflow-step:last-child::before {
  display: none;
}

.workflow-step-marker {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #1677ff;
  background: #eff6ff;
  border-radius: 50%;
}

.workflow-step.running .workflow-step-marker {
  background: #f8fafc;
}

.workflow-step-body {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding-top: 1px;
}

.workflow-step-number {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 12px;
}

.workflow-step-title {
  min-width: 0;
  color: #1f2937;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.workflow-error {
  margin-top: 12px;
  padding: 8px 10px;
  color: #cf1322;
  font-size: 13px;
  line-height: 1.5;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
}

.streaming-workflow {
  padding-right: 4px;
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

.selected-element-alert {
  margin-bottom: 10px;
}

.selected-element-alert :deep(.ant-alert-description) {
  word-break: break-word;
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

.send-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
