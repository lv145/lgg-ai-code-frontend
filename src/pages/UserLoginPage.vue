<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUser.ts'
import { login } from '@/api/userController.ts'
import { message } from 'ant-design-vue'
import { APP_NAME } from '@/constants/site'
const router = useRouter()
const loginUserStore = useLoginUserStore()
const formState = ref({
  userAccount: '',
  userPassword: '',
})


/**
 * 提交表单
 * @param values
 */
const handleSubmit = async (values: any) => {
  const res = await login(values)
  // 登录成功，把登录态保存到全局状态中
  if (res.data.code === 0 && res.data.data) {
    await loginUserStore.fetchLoginUser()
    message.success('登录成功')
    router.push({
      path: '/',
      replace: true,
    })
  } else {
    message.error('登录失败，' + res.data.message)
  }
}


</script>

<template>
    <div id="userLoginPage" class="auth-page">
      <section class="auth-aside">
        <RouterLink to="/" class="auth-brand"><span class="brand-mark">创</span><span>{{ APP_NAME }}</span></RouterLink>
        <div class="aside-copy"><span class="eyebrow">IDEAS INTO PRODUCTS</span><h1>让每一个好想法<br />都快速变成现实。</h1><p>用自然语言描述你的灵感，创界 AI 为你生成完整、可预览、可部署的应用。</p><div class="aside-note"><span class="online-dot"></span>从创意到上线，只需一段对话</div></div>
        <span class="aside-caption">AI APP STUDIO · CREATE WITHOUT LIMITS</span>
      </section>
      <section class="auth-main">
        <div class="auth-card"><span class="eyebrow">WELCOME BACK</span><h2 class="title">欢迎回来</h2><div class="desc">登录账号，继续你的创作</div>
      <a-form :model="formState" name="basic" autocomplete="off" @finish="handleSubmit">
        <a-form-item name="userAccount" label="账号" :rules="[{ required: true, message: '请输入账号' }]">
          <a-input v-model:value="formState.userAccount" placeholder="请输入账号" />
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
        <div class="tips">
          没有账号？
          <RouterLink to="/user/register">去注册</RouterLink>
        </div>
        <a-form-item>
          <a-button type="primary" html-type="submit" style="width: 100%">登录</a-button>
        </a-form-item>
      </a-form>
        <p class="auth-footnote">登录即刻开启 AI 应用创作之旅</p></div>
        <span class="auth-copyright">© 2026 {{ APP_NAME }}</span>
      </section>
    </div>
  </template>
  <style scoped>
  #userLoginPage { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr); background: #fff; color: #252535; }
  .auth-aside { min-height: 100vh; position: relative; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; padding: 44px clamp(32px, 7vw, 100px); background: radial-gradient(ellipse at 85% 16%, rgba(193,177,255,.38), transparent 35%), radial-gradient(ellipse at 4% 92%, rgba(177,196,255,.4), transparent 38%), linear-gradient(145deg, #f6f4ff 0%, #eeecff 50%, #f7f8ff 100%); }
  .auth-brand { display:flex; align-items:center; gap:12px; color:#242338; text-decoration:none; font-weight:650; font-size:17px; }
  .brand-mark { display:grid; place-items:center; width:38px; height:38px; border-radius:13px; color:white; background:linear-gradient(145deg,#8773ed,#6352cc); box-shadow:0 7px 18px #7969da44; }
  .aside-copy { max-width:510px; animation: auth-rise .65s ease both; }
  .eyebrow { color:#7568c9; font-size:11px; letter-spacing:.18em; font-weight:700; }
  .aside-copy h1 { margin:18px 0; color:#242338; font-size:clamp(38px,4.5vw,58px); line-height:1.32; letter-spacing:-.045em; font-weight:700; }
  .aside-copy>p { max-width:405px; color:#77758e; font-size:15px; line-height:1.95; }
  .aside-note { display:flex; align-items:center; gap:10px; margin-top:34px; color:#615c84; font-size:13px; }
  .online-dot { width:8px; height:8px; border-radius:50%; background:#79c9a0; box-shadow:0 0 0 4px #79c9a022; }
  .aside-caption,.auth-copyright { color:#a3a0b5; font-size:10px; letter-spacing:.12em; }
  .auth-main { min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:44px; position:relative; }
  .auth-card { width:min(100%, 390px); animation:auth-rise .55s ease both; }
  .title { text-align:left; margin:14px 0 5px; color:#242338; font-size:30px; font-weight:650; }
  
  .desc {
    color: #9290a3;
    margin-bottom: 30px;
  }
  
  .tips {
    margin-bottom: 16px;
    color: #8e8b9e;
    font-size: 13px;
    text-align: right;
  }
  #userLoginPage :deep(.ant-form-item-label > label) { color:#525065; font-weight:550; }
  #userLoginPage :deep(.ant-input), #userLoginPage :deep(.ant-input-affix-wrapper) { min-height:44px; border-radius:10px; }
  #userLoginPage :deep(.ant-btn-primary) { height:46px; border-radius:10px; background:#7362d2; box-shadow:0 8px 18px #7362d233; font-weight:600; }
  #userLoginPage :deep(.ant-btn-primary:hover) { background:#6250c0; }
  #userLoginPage :deep(.ant-form-item) { margin-bottom:21px; }
  #userLoginPage a:not(.auth-brand) { color:#7161ce; font-weight:600; }
  .auth-footnote { margin-top:22px; color:#a4a1b3; text-align:center; font-size:12px; }
  .auth-copyright { position:absolute; bottom:27px; }
  @keyframes auth-rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @media(max-width:760px) { #userLoginPage { grid-template-columns:1fr; } .auth-aside { display:none; } .auth-main { min-height:100vh; padding:30px 24px 72px; background:radial-gradient(ellipse at 50% 0%,#eeecff,transparent 48%),#fff; } .auth-copyright { bottom:22px; } }
  @media(prefers-reduced-motion:reduce) { #userLoginPage *, #userLoginPage *::before { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; } }
  </style>
