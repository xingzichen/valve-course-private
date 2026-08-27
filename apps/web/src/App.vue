<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, post, sessionUser } from './api';

const route = useRoute();
const router = useRouter();
const ready = ref(false);
const setupRequired = ref(false);
const password = ref('');
const authError = ref('');
const pageTitle = computed(() => String(route.meta.title ?? '瓣程'));
const nav: Array<[string, string, string]> = [
  ['/', '⌂', '总览'],
  ['/timeline', '◷', '病程'],
  ['/orders', 'Rx', '医嘱'],
  ['/documents', '▤', '报告'],
  ['/data', '⌁', '数据'],
  ['/assistant', '✦', '助手'],
  ['/sources', '◎', '来源'],
  ['/profile', '○', '档案']
];

async function check() {
  try {
    const s = await api<{ user: { id: string; displayName: string } }>('/auth/session');
    sessionUser.value = s.user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const s = await api<{ setupRequired: boolean }>('/auth/setup');
      setupRequired.value = s.setupRequired;
    }
  } finally {
    ready.value = true;
  }
}
async function authenticate() {
  authError.value = '';
  try {
    if (setupRequired.value) await post('/auth/setup', { password: password.value });
    const result = await post<{ user: { id: string; displayName: string } }>('/auth/login', {
      password: password.value
    });
    sessionUser.value = result.user;
    password.value = '';
    await router.push('/');
  } catch (e) {
    authError.value = e instanceof Error ? e.message : '登录失败';
  }
}
async function logout() {
  await post('/auth/logout', {});
  sessionUser.value = null;
  setupRequired.value = false;
}
onMounted(check);
</script>

<template>
  <div v-if="!ready" class="auth-screen"><div class="brand-pulse">瓣</div></div>
  <main v-else-if="!sessionUser" class="auth-screen">
    <form class="auth-card" @submit.prevent="authenticate">
      <div class="brand-lock">瓣</div>
      <p class="eyebrow">PRIVATE CARE JOURNAL</p>
      <h1>瓣程</h1>
      <p class="muted">一份只属于家人的病程记忆</p>
      <label
        ><span>{{ setupRequired ? '设置管理密码' : '管理密码' }}</span
        ><input
          v-model="password"
          type="password"
          autocomplete="current-password"
          minlength="12"
          required
          placeholder="至少 12 个字符"
      /></label>
      <p v-if="authError" class="error">{{ authError }}</p>
      <button class="primary wide" type="submit">
        {{ setupRequired ? '建立私人档案' : '进入档案' }}
      </button>
      <small>资料仅保存在您的 NAS；系统不会自动改变任何医嘱。</small>
    </form>
  </main>
  <div v-else class="app-shell">
    <aside class="side">
      <div class="side-brand">
        <span>瓣</span>
        <div><strong>瓣程</strong><small>私人病程管理</small></div>
      </div>
      <nav>
        <RouterLink v-for="item in nav" :key="item[0]" :to="item[0]"
          ><i>{{ item[1] }}</i
          ><span>{{ item[2] }}</span></RouterLink
        >
      </nav>
      <div class="privacy"><b>● 本地私有</b><span>数据保存在家庭 NAS</span></div>
    </aside>
    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">
            {{
              new Date().toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })
            }}
          </p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="row-actions">
          <RouterLink class="quiet button" to="/profile">档案</RouterLink
          ><button class="quiet" @click="logout">退出</button>
        </div>
      </header>
      <div class="content"><RouterView /></div>
    </section>
    <nav class="bottom-nav">
      <RouterLink v-for="item in nav.slice(0, 6)" :key="item[0]" :to="item[0]"
        ><i>{{ item[1] }}</i
        ><span>{{ item[2] }}</span></RouterLink
      >
    </nav>
  </div>
</template>
