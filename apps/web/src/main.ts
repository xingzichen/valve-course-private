import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

import App from './App.vue';
import AssistantView from './views/AssistantView.vue';
import DashboardView from './views/DashboardView.vue';
import DataView from './views/DataView.vue';
import DocumentsView from './views/DocumentsView.vue';
import OrdersView from './views/OrdersView.vue';
import ProfileView from './views/ProfileView.vue';
import SourcesView from './views/SourcesView.vue';
import TimelineView from './views/TimelineView.vue';
import './styles.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView, meta: { title: '今日总览' } },
    { path: '/timeline', component: TimelineView, meta: { title: '病程时间线' } },
    { path: '/orders', component: OrdersView, meta: { title: '医嘱与用药' } },
    { path: '/documents', component: DocumentsView, meta: { title: '病例与报告' } },
    { path: '/data', component: DataView, meta: { title: '指标与心电' } },
    { path: '/assistant', component: AssistantView, meta: { title: '共同决策助手' } },
    { path: '/sources', component: SourcesView, meta: { title: '信息来源' } },
    { path: '/profile', component: ProfileView, meta: { title: '患者档案' } }
  ]
});

createApp(App).use(router).mount('#app');
