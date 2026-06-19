<template>
  <div id="appManagePage">
    <!-- 搜索表单 -->
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="应用名称">
        <a-input v-model:value="searchParams.appName" placeholder="输入应用名称" />
      </a-form-item>
      <a-form-item label="创建者">
        <a-input
          v-model:value="searchParams.userId"
          placeholder="输入用户ID"
          class="creator-input"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="应用类型">
        <a-select
          v-model:value="searchParams.codeGenType"
          placeholder="选择类型"
          allowClear
          class="code-gen-type-select"
        >
          <a-select-option
            v-for="item in CODE_GEN_TYPE_OPTIONS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit">搜索</a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <!-- 表格 -->
    <a-table
      :columns="columns"
      :data-source="data"
      :pagination="pagination"
      @change="doTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'cover'">
          <a-image v-if="record.cover" :src="record.cover" :width="120" />
          <div v-else class="no-cover">暂无封面</div>
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ formatDate(record.createTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'priority'">
          <a-tag v-if="record.priority === 99" color="gold">精选</a-tag>
          <span v-else>{{ record.priority || 0 }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'codeGenType'">
          {{ getCodeGenTypeLabel(record.codeGenType) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button @click="doEdit(record)">编辑</a-button>
            <a-button
              v-if="isAdmin && record.priority !== 99"
              class="featured-button"
              @click="doFeatured(record)"
            >
              精选
            </a-button>
            <a-button
              v-if="isAdmin && record.priority === 99"
              class="cancel-featured-button"
              @click="doCancelFeatured(record)"
            >
              取消精选
            </a-button>
            <a-button danger @click="doDelete(record.id)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
import { message, Modal } from 'ant-design-vue'
import { onMounted, ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listAppVoByPage, adminDeleteApp, adminUpdateApp } from '@/api/appController'
import { CODE_GEN_TYPE_OPTIONS, getCodeGenTypeLabel } from '@/constants/codeGenType'
import { useLoginUserStore } from '@/stores/loginUser'
import ACCESS_ENUM from '@/access/accessEnum'

const router = useRouter()
const loginUserStore = useLoginUserStore()

// 数据
const data = ref<API.AppVO[]>([])
const total = ref(0)
const isAdmin = computed(() => loginUserStore.loginUser?.userRole === ACCESS_ENUM.ADMIN)

// 搜索条件
const searchParams = reactive<API.AppQueryRequest>({
  pageNum: 1,
  pageSize: 10,
})

// 分页参数
const pagination = computed(() => {
  return {
    current: searchParams.pageNum ?? 1,
    pageSize: searchParams.pageSize ?? 10,
    total: total.value,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`,
  }
})

// 格式化日期
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 搜索数据
const doSearch = () => {
  searchParams.pageNum = 1
  fetchData()
}

// 删除应用
const doDelete = (id: string) => {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这个应用吗？删除后无法恢复。',
    onOk: async () => {
      const res = await adminDeleteApp({ id })
      if (res.data.code === 0) {
        message.success('删除成功')
        fetchData()
      } else {
        message.error('删除失败：' + res.data.message)
      }
    },
  })
}

// 编辑应用
const doEdit = (record: API.AppVO) => {
  router.push(`/admin/appManage/edit/${record.id}`)
}

// 设为精选
const doFeatured = async (record: API.AppVO) => {
  if (!isAdmin.value) {
    message.warning('只有管理员可以执行精选操作')
    return
  }
  const res = await adminUpdateApp({
    id: record.id,
    priority: 99,
  })
  if (res.data.code === 0) {
    message.success('已设为精选')
    fetchData()
  } else {
    message.error('操作失败：' + res.data.message)
  }
}

// 取消精选
const doCancelFeatured = async (record: API.AppVO) => {
  if (!isAdmin.value) {
    message.warning('只有管理员可以执行精选操作')
    return
  }
  const res = await adminUpdateApp({
    id: record.id,
    priority: 0,
  })
  if (res.data.code === 0) {
    message.success('已取消精选')
    fetchData()
  } else {
    message.error('操作失败：' + res.data.message)
  }
}

// 表格变化处理
const doTableChange = (page: any) => {
  searchParams.pageNum = page.current
  searchParams.pageSize = page.pageSize
  fetchData()
}

// 获取数据
const fetchData = async () => {
  const res = await listAppVoByPage({
    ...searchParams,
  })
  if (res.data.code === 0 && res.data.data) {
    data.value = res.data.data.records ?? []
    total.value = res.data.data.totalRow ?? 0
  } else {
    message.error('获取数据失败：' + res.data.message)
  }
}

// 页面加载时请求一次
onMounted(() => {
  fetchData()
})

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
  },
  {
    title: '应用名称',
    dataIndex: 'appName',
  },
  {
    title: '封面',
    dataIndex: 'cover',
  },
  {
    title: '生成类型',
    dataIndex: 'codeGenType',
  },
  {
    title: '优先级',
    dataIndex: 'priority',
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
  },
  {
    title: '操作',
    key: 'action',
  },
]
</script>

<style scoped>
#appManagePage {
  padding: 24px;
}

.creator-input {
  width: 180px;
}

.code-gen-type-select {
  width: 220px;
}

.featured-button {
  color: #ad6800;
  background: #fff7e6;
  border-color: #ffd591;
}

.featured-button:hover,
.featured-button:focus {
  color: #874d00;
  background: #ffe7ba;
  border-color: #ffc069;
}

.cancel-featured-button {
  color: #0958d9;
  background: #e6f4ff;
  border-color: #91caff;
}

.cancel-featured-button:hover,
.cancel-featured-button:focus {
  color: #003eb3;
  background: #bae0ff;
  border-color: #69b1ff;
}

.no-cover {
  width: 120px;
  height: 80px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  border-radius: 4px;
}
</style>
