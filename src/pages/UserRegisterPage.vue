<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/api/userController.ts'
import { message } from 'ant-design-vue'
import { APP_NAME } from '@/constants/site'

const router = useRouter()
const formState = ref({
  userAccount: '',
  userName: '',
  userPassword: '',
  checkPassword: '',
})

/**
 * 校验两次密码是否一致
 */
const validateCheckPassword = async (_rule: any, value: string) => {
  if (value && value !== formState.value.userPassword) {
    return Promise.reject('两次输入的密码不一致')
  }
  return Promise.resolve()
}

const checkPasswordRules = [
  { required: true, message: '请确认密码' },
  { min: 8, message: '密码不能小于 8 位' },
  { validator: validateCheckPassword },
]

/**
 * 提交注册表单
 * @param values
 */
const handleSubmit = async (values: any) => {
  const res = await register(values)
  if (res.data.code === 0 && res.data.data) {
    message.success('注册成功')
    router.push({
      path: '/user/login',
      replace: true,
    })
  } else {
    message.error('注册失败，' + res.data.message)
  }
}
</script>

<template>
  <div id="userRegisterPage" class="auth-page">
    <section class="auth-aside">
      <RouterLink to="/" class="auth-brand"><span class="brand-mark">创</span><span>{{ APP_NAME }}</span></RouterLink>
      <div class="aside-copy"><span class="eyebrow">START CREATING</span><h1>你的下一款应用<br />从这里开始。</h1><p>无需复杂开发流程。告诉我们你的创意，把想法交给 AI，亲手看它变成真实产品。</p><div class="aside-note"><span class="online-dot"></span>注册账号，开启第一款 AI 应用</div></div>
      <span class="aside-caption">AI APP STUDIO · CREATE WITHOUT LIMITS</span>
    </section>
    <section class="auth-main">
    <div class="auth-card"><span class="eyebrow">CREATE YOUR ACCOUNT</span><h2 class="title">创建账号</h2>
    <div class="desc">加入创界，开启你的 AI 创作之旅</div>
    <a-form :model="formState" name="basic" autocomplete="off" @finish="handleSubmit">
      <a-form-item name="userAccount" label="账号" :rules="[{ required: true, message: '请输入账号' }]">
        <a-input v-model:value="formState.userAccount" placeholder="请输入账号" />
      </a-form-item>
      <a-form-item name="userName" label="用户名" :rules="[{ required: true, message: '请输入用户名' }]">
        <a-input v-model:value="formState.userName" placeholder="请输入用户名" />
      </a-form-item>
      <a-form-item
        name="userPassword"
        label="密码"
        :rules="[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码不能小于 8 位' },
        ]"
      >
        <a-input-password v-model:value="formState.userPassword" placeholder="请输入密码" />
      </a-form-item>
      <a-form-item name="checkPassword" label="确认密码" :rules="checkPasswordRules">
        <a-input-password v-model:value="formState.checkPassword" placeholder="请确认密码" />
      </a-form-item>
      <div class="tips">
        已有账号？
        <RouterLink to="/user/login">去登录</RouterLink>
      </div>
      <a-form-item>
        <a-button type="primary" html-type="submit" style="width: 100%">注册</a-button>
      </a-form-item>
    </a-form>
    <p class="auth-footnote">简单注册，即刻开始创作</p></div>
    <span class="auth-copyright">© 2026 {{ APP_NAME }}</span>
    </section>
  </div>
</template>

<style scoped>
#userRegisterPage { min-height:100vh; display:grid; grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr); background:#fff; color:#252535; }
.auth-aside { min-height:100vh; position:relative; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; padding:44px clamp(32px,7vw,100px); background:radial-gradient(ellipse at 85% 16%,rgba(193,177,255,.38),transparent 35%),radial-gradient(ellipse at 4% 92%,rgba(177,196,255,.4),transparent 38%),linear-gradient(145deg,#f6f4ff,#eeecff 50%,#f7f8ff); }
.auth-brand { display:flex; align-items:center; gap:12px; color:#242338; text-decoration:none; font-weight:650; font-size:17px; }
.brand-mark { display:grid; place-items:center; width:38px; height:38px; border-radius:13px; color:#fff; background:linear-gradient(145deg,#8773ed,#6352cc); box-shadow:0 7px 18px #7969da44; }
.aside-copy { max-width:510px; animation:auth-rise .65s ease both; }
.eyebrow { color:#7568c9; font-size:11px; letter-spacing:.18em; font-weight:700; }
.aside-copy h1 { margin:18px 0; color:#242338; font-size:clamp(38px,4.5vw,58px); line-height:1.32; letter-spacing:-.045em; font-weight:700; }
.aside-copy>p { max-width:405px; color:#77758e; font-size:15px; line-height:1.95; }
.aside-note { display:flex; align-items:center; gap:10px; margin-top:34px; color:#615c84; font-size:13px; }
.online-dot { width:8px; height:8px; border-radius:50%; background:#79c9a0; box-shadow:0 0 0 4px #79c9a022; }
.aside-caption,.auth-copyright { color:#a3a0b5; font-size:10px; letter-spacing:.12em; }
.auth-main { min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:44px; position:relative; }
.auth-card { width:min(100%,390px); animation:auth-rise .55s ease both; }
.title { text-align:left; margin:14px 0 5px; color:#242338; font-size:30px; font-weight:650; }
.desc { color:#9290a3; margin-bottom:24px; }
.tips { margin-bottom:16px; color:#8e8b9e; font-size:13px; text-align:right; }
#userRegisterPage :deep(.ant-form-item-label > label) { color:#525065; font-weight:550; }
#userRegisterPage :deep(.ant-form-item-row) { display:flex; }
#userRegisterPage :deep(.ant-form-item-label) { flex:0 0 132px; max-width:132px; }
#userRegisterPage :deep(.ant-form-item-control) { flex:1 1 0; min-width:0; max-width:calc(100% - 132px); }
#userRegisterPage :deep(.ant-input), #userRegisterPage :deep(.ant-input-affix-wrapper) { min-height:42px; border-radius:10px; }
#userRegisterPage :deep(.ant-btn-primary) { height:46px; border-radius:10px; background:#7362d2; box-shadow:0 8px 18px #7362d233; font-weight:600; }
#userRegisterPage :deep(.ant-btn-primary:hover) { background:#6250c0; }
#userRegisterPage :deep(.ant-form-item) { margin-bottom:15px; }
#userRegisterPage a:not(.auth-brand) { color:#7161ce; font-weight:600; }
.auth-footnote { margin-top:18px; color:#a4a1b3; text-align:center; font-size:12px; }
.auth-copyright { position:absolute; bottom:27px; }
@keyframes auth-rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
@media(max-width:760px) { #userRegisterPage { grid-template-columns:1fr; } .auth-aside { display:none; } .auth-main { min-height:100vh; padding:30px 24px 72px; background:radial-gradient(ellipse at 50% 0%,#eeecff,transparent 48%),#fff; } .auth-copyright { bottom:22px; } }
@media(prefers-reduced-motion:reduce) { #userRegisterPage *, #userRegisterPage *::before { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; } }
</style>
