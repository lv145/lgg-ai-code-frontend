<script setup lang="ts">
import {computed, ref, watch } from 'vue'
import {useRoute, useRouter } from 'vue-router'

import type { MenuProps } from 'ant-design-vue'
import {type MenuItemConfig, originItems } from '@/config/menu'
import logoUrl from '@/assets/logo.png'
// JS 中引入 Store
import { useLoginUserStore } from '@/stores/loginUser.ts'
import { userLogout } from "@/api/userController.ts"
import { message } from 'ant-design-vue'
const loginUserStore = useLoginUserStore()
const siteTitle = 'AI 零代码生成平台'
const router = useRouter()
const route = useRoute()

const selectedKeys = ref<string[]>([])
const drawerVisible = ref(false)

import { LogoutOutlined } from '@ant-design/icons-vue'
import checkAccess from "@/access/checkAccess.ts";


// 用户注销
const doLogout = async () => {
  const res = await userLogout()
  if (res.data.code === 0) {
    loginUserStore.setLoginUser({
      userName: '未登录',
    })
    message.success('退出登录成功')
    await router.push('/user/login')
  } else {
    message.error('退出登录失败，' + res.data.message)
    await router.push('/user/login')
  }
}


// 过滤菜单项
const filterMenus = (menus = [] as MenuItemConfig[]) => {
  return menus?.filter((menu) => {
    // 从路由表中查找对应的路由项
    const route = router.options.routes.find((r) => r.path === menu.key)
    // 1. 隐藏菜单直接过滤掉
    if (route?.meta?.hideInMenu) {
      return false
    }
    // 2. 根据权限过滤
    return checkAccess(loginUserStore.loginUser, route?.meta?.access as string)
  })
}


// 展示在菜单的路由数组
 const menuItems=  computed<MenuItemConfig[]>(() => filterMenus(originItems) || []);

// 菜单数据
const antMenuItems = computed(() => menuItems.value.map((item) => ({
    key: item.key,
    label: item.label,
    title: item.title,
     icon: item.icon,
  })))

// 同步选中状态：根据当前路由找到对应的菜单 key
const syncSelectedKeys = () => {
  const matched = menuItems.value.find((item) => item.key === route.path)
  selectedKeys.value = matched ? [matched.key] : []
}

// 监听路由变化 + 立即执行一次
watch(() => route.path, syncSelectedKeys, { immediate: true })

// 点击菜单跳转
const navigateByKey = (key: string) => {
  const target = menuItems.value.find((item) => item.key === key)
  if (target && target.key?.startsWith("/")) {
    router.push(target.key)
  }
}

const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
  navigateByKey(key as string)
  drawerVisible.value = false
}
</script>

<template>
  <div class="global-header">
    <div class="header-left">
      <RouterLink to="/" class="brand">
        <img :src="logoUrl" alt="logo" class="logo" />
        <span class="site-title">{{ siteTitle }}</span>
      </RouterLink>

      <a-menu
        v-model:selected-keys="selectedKeys"
        mode="horizontal"
        :items="antMenuItems"
        class="header-menu desktop-menu"
        @click="handleMenuClick"
      />
    </div>

    <div class="header-right">

        <div v-if="loginUserStore.loginUser.id">
          <a-dropdown>
            <a-space>
              <a-avatar :src="loginUserStore.loginUser.userAvatar" />
              {{ loginUserStore.loginUser.userName ?? '无名' }}
            </a-space>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="doLogout">
                  <LogoutOutlined />
                  退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
      </div>
      <div v-else>
        <a-button type="primary" href="/user/login">登录</a-button>
      </div>
    </div>


    </div>
    <div>
    <a-drawer
      v-model:open="drawerVisible"
      placement="left"
      :closable="true"
      title="菜单"
      class="mobile-drawer"
    >
      <a-menu
        v-model:selected-keys="selectedKeys"
        mode="inline"
        :items="antMenuItems"
        @click="handleMenuClick"
      />
    </a-drawer>
  </div>
</template>

<style scoped>
.global-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 64px;
  padding: 0 24px;
  background: #fff;
}

.header-left {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}

.brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-right: 24px;
  color: inherit;
  text-decoration: none;
}

.logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.site-title {
  margin-left: 12px;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.header-menu {
  flex: 1;
  min-width: 0;
  border-bottom: none;
  line-height: 62px;
}

.desktop-menu {
  display: block;
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 16px;
}

.mobile-menu-trigger {
  display: none;
  font-size: 18px;
}

@media (max-width: 768px) {
  .global-header {
    padding: 0 16px;
  }

  .site-title {
    font-size: 16px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .desktop-menu {
    display: none;
  }

  .mobile-menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
  }
}
</style>
