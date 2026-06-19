import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import UserLoginPage from '../pages/UserLoginPage.vue'
import UserRegisterPage from '../pages/UserRegisterPage.vue'
import UserManagePage from '../pages/UserManagePage.vue'
import AppChatPage from '../pages/AppChatPage.vue'
import AppManagePage from '../pages/AppManagePage.vue'
import AppEditPage from '../pages/AppEditPage.vue'
import ACCESS_ENUM from "@/access/accessEnum.ts";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: '主页',
      component: HomePage,
    },
    {
      path: '/user/login',
      name: '用户登录',
      component: UserLoginPage,
    },
    {
      path: '/user/register',
      name: '用户注册',
      component: UserRegisterPage,
    },
    {
      path: '/admin/userManage',
      name: '用户管理',
      component: UserManagePage,
      meta: {
        access: ACCESS_ENUM.ADMIN,
      }
    },
    {
      path: '/app/chat/:id',
      name: '应用对话',
      component: AppChatPage,
      meta: {
        access: ACCESS_ENUM.USER,
      }
    },
    {
      path: '/admin/appManage',
      name: '应用管理',
      component: AppManagePage,
      meta: {
        access: ACCESS_ENUM.ADMIN,
      }
    },
    {
      path: '/admin/appManage/edit/:id',
      name: '应用编辑',
      component: AppEditPage,
      meta: {
        access: ACCESS_ENUM.ADMIN,
      }
    },
    {
      path: '/app/edit/:id',
      name: '我的应用编辑',
      component: AppEditPage,
      meta: {
        access: ACCESS_ENUM.USER,
      }
    },
  ],

})

export default router
