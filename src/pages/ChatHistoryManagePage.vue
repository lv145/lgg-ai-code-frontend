<template>
  <div id="chatHistoryManagePage">
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="对话ID">
        <a-input
          v-model:value="searchParams.id"
          placeholder="输入对话ID"
          class="search-number-input"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="应用ID">
        <a-input
          v-model:value="searchParams.appId"
          placeholder="输入应用ID"
          class="search-number-input"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="用户ID">
        <a-input
          v-model:value="searchParams.userId"
          placeholder="输入用户ID"
          class="search-number-input"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="消息类型">
        <a-select
          v-model:value="searchParams.messageType"
          placeholder="选择消息类型"
          allow-clear
          class="message-type-select"
        >
          <a-select-option value="user">用户</a-select-option>
          <a-select-option value="assistant">AI</a-select-option>
          <a-select-option value="ai">AI</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="消息内容">
        <a-input v-model:value="searchParams.message" placeholder="输入消息内容" allow-clear />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit">搜索</a-button>
      </a-form-item>
    </a-form>

    <a-divider />

    <a-table
      :columns="columns"
      :data-source="data"
      :pagination="pagination"
      row-key="id"
      @change="doTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'messageType'">
          <a-tag :color="getMessageTypeColor(record.messageType)">
            {{ getMessageTypeText(record.messageType) }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'message'">
          <a-typography-paragraph
            class="message-cell"
            :ellipsis="{ rows: 2, expandable: true, symbol: '展开' }"
            :content="record.message || '-'"
          />
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ formatDate(record.createTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'updateTime'">
          {{ formatDate(record.updateTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'isDelete'">
          <a-tag :color="record.isDelete === 1 ? 'red' : 'green'">
            {{ record.isDelete === 1 ? '已删除' : '正常' }}
          </a-tag>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { listChatHistoryVoByPage } from '@/api/chatHistoryController'

const data = ref<API.ChatHistory[]>([])
const total = ref(0)

const searchParams = reactive<API.ChatHistoryQueryRequest>({
  pageNum: 1,
  pageSize: 10,
})

const pagination = computed(() => {
  return {
    current: searchParams.pageNum ?? 1,
    pageSize: searchParams.pageSize ?? 10,
    total: total.value,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`,
  }
})

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

const getMessageTypeText = (messageType?: string) => {
  const normalizedType = messageType?.toLowerCase()
  if (normalizedType === 'user') return '用户'
  if (normalizedType === 'assistant' || normalizedType === 'ai') return 'AI'
  return messageType || '-'
}

const getMessageTypeColor = (messageType?: string) => {
  return messageType?.toLowerCase() === 'user' ? 'blue' : 'purple'
}

const doSearch = () => {
  searchParams.pageNum = 1
  fetchData()
}

const doTableChange = (page: any) => {
  searchParams.pageNum = page.current
  searchParams.pageSize = page.pageSize
  fetchData()
}

const fetchData = async () => {
  const res = await listChatHistoryVoByPage({
    ...searchParams,
  })
  if (res.data.code === 0 && res.data.data) {
    data.value = res.data.data.records ?? []
    total.value = res.data.data.totalRow ?? 0
  } else {
    message.error('获取数据失败：' + res.data.message)
  }
}

onMounted(() => {
  fetchData()
})

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    width: 160,
  },
  {
    title: '应用ID',
    dataIndex: 'appId',
    width: 160,
  },
  {
    title: '用户ID',
    dataIndex: 'userId',
    width: 160,
  },
  {
    title: '消息类型',
    dataIndex: 'messageType',
    width: 120,
  },
  {
    title: '消息内容',
    dataIndex: 'message',
  },
  {
    title: '父消息ID',
    dataIndex: 'parentId',
    width: 160,
  },
  {
    title: '状态',
    dataIndex: 'isDelete',
    width: 100,
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    width: 180,
  },
  {
    title: '更新时间',
    dataIndex: 'updateTime',
    width: 180,
  },
]
</script>

<style scoped>
#chatHistoryManagePage {
  padding: 24px;
}

.search-number-input {
  width: 180px;
}

.message-type-select {
  width: 160px;
}

.message-cell {
  max-width: 520px;
  margin-bottom: 0;
}
</style>
