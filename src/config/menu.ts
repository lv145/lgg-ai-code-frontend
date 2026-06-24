
import {computed, h} from "vue";
import {HomeOutlined, AppstoreOutlined, MessageOutlined} from "@ant-design/icons-vue";
import type {MenuProps} from "ant-design-vue";
import {useLoginUserStore} from "@/stores/loginUser";

// menu.ts
import type { VNode } from 'vue';

// 只定义你需要的简单菜单项
export interface MenuItemConfig {
  key: string;
  label?: string | VNode | (() => VNode);
  title: string;
  icon?: () => VNode;
}
// 菜单配置项
// @ts-ignore
export const originItems: MenuItemConfig[] = [
  {
    key: '/',
    icon: () => h(HomeOutlined),
    label: '主页',
    title: '主页'
  },
  {
    key: '/admin/userManage',
    label: '用户管理',
    title: '用户管理'
  },
  {
    key: '/admin/appManage',
    icon: () => h(AppstoreOutlined),
    label: '应用管理',
    title: '应用管理'
  },
  {
    key: '/admin/chatHistoryManage',
    icon: () => h(MessageOutlined),
    label: '对话管理',
    title: '对话管理'
  },
  {
    key: 'github',
    label:h('a', { href: 'https://github.com/lv145', target: '_blank' }, 'GitHub'),
    title: 'GitHub'
  },
]



