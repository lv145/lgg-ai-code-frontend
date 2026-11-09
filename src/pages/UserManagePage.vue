
<template>

  <div id="userManagePage">
    <!-- 搜索表单 -->
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="账号">
        <a-input v-model:value="searchParams.userAccount" placeholder="输入账号" />
      </a-form-item>
      <a-form-item label="用户名">
        <a-input v-model:value="searchParams.userName" placeholder="输入用户名" />
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
    :scroll="{ x: 1400 }"
    @change="doTableChange"
  >


  <template #headerCell="{ column }">
      <template v-if="column.key === 'name'">
        <span>
          <smile-outlined />
          Name
        </span>
      </template>
    </template>

    <template #bodyCell="{ column, record }">
      <template v-if="column.dataIndex === 'userAvatar'">
        <a-avatar :size="48" :style="getAvatarStyle(record.userName)" class="user-avatar">
          {{ getAvatarText(record.userName) }}
        </a-avatar>
      </template>
      <template v-else-if="column.dataIndex === 'userRole'">
        <div v-if="record.userRole === 'admin'">
          <a-tag color="green">管理员</a-tag>
        </div>
        <div v-else>
          <a-tag color="blue">普通用户</a-tag>
        </div>
      </template>
      <template v-else-if="column.dataIndex === 'createTime'">
        {{ dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss') }}
      </template>
      <template v-else-if="column.key === 'action'">
        <a-button
          v-if="String(record.id) !== String(loginUserStore.loginUser.id)"
          danger
          @click="doDelete(record.id)"
        >删除</a-button>
      </template>
    </template>

  </a-table>
  </div>
</template>
<script lang="ts" setup>
import { SmileOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue'
import { onMounted, ref, reactive } from 'vue'
import {deleteUser, listUserVoByPage } from '@/api/userController'
import dayjs from "dayjs";
import { computed } from "vue";
import { getAvatarStyle, getAvatarText } from '@/utils/avatar'
import { useLoginUserStore } from '@/stores/loginUser'

const loginUserStore = useLoginUserStore()

// 数据
const data = ref<API.UserVO[]>([])
const total = ref(0)
// 获取数据
const doSearch = () => {
  // 重置页码
  searchParams.pageNum = 1
  fetchData()
}
// 删除数据
const doDelete = async (id?: string) => {
  if (!id) {
    return
  }
  if (String(id) === String(loginUserStore.loginUser.id)) return
  Modal.confirm({
    title: '确认删除用户',
    content: '删除后无法恢复，确定要删除该用户吗？',
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      const res = await deleteUser({ id })
      if (res.data.code === 0) {
        message.success('删除成功')
        fetchData()
      } else {
        message.error('删除失败：' + res.data.message)
      }
    },
  })
}

// 搜索条件
const searchParams = reactive<API.UserQueryRequest>({
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
// 表格变化处理
const doTableChange = (page: any) => {
  searchParams.pageNum = page.current
  searchParams.pageSize = page.pageSize
  fetchData()
}
// 获取数据
const fetchData = async () => {
  const res = await listUserVoByPage({
    ...searchParams,
  })
  if (res.data.data) {
    data.value = res.data.data.records ?? []
    total.value = res.data.data.totalRow ?? 0
  } else {
    message.error('获取数据失败，' + res.data.message)
  }
}

// 页面加载时请求一次
onMounted(() => {
  fetchData()
})

const columns = [
  {
    title: 'id',
    dataIndex: 'id',
  },
  {
    title: '账号',
    dataIndex: 'userAccount',
  },
  {
    title: '用户名',
    dataIndex: 'userName',
  },
  {
    title: '头像',
    dataIndex: 'userAvatar',
  },
  {
    title: '简介',
    dataIndex: 'userProfile',
  },
  {
    title: '用户角色',
    dataIndex: 'userRole',
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
  },
  {
    title: '操作',
    key: 'action',
  },
];

</script>




<style scoped>
#userManagePage {
  padding: 28px clamp(18px, 4vw, 48px);
  min-height: calc(100vh - 120px);
}

#userManagePage :deep(.ant-form) { padding:20px; border:1px solid #efedf3; border-radius:14px; background:#fff; }
#userManagePage :deep(.ant-table-wrapper) { padding:4px 18px 16px; border:1px solid #efedf3; border-radius:14px; background:#fff; }
#userManagePage :deep(.ant-table-thead > tr > th) { color:#706d80; background:#f8f7fb; font-weight:600; }
#userManagePage :deep(.ant-table-tbody > tr:hover > td) { background:#faf9fd; }
#userManagePage :deep(.ant-input) { border-radius:8px; }

.user-avatar {
  font-size: 20px;
  font-weight: 500;
}

</style>
