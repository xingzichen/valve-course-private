<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import EmptyState from '../components/EmptyState.vue';
import LineSpark from '../components/LineSpark.vue';

const data = ref<any>(null);
const error = ref('');
onMounted(async () => {
  try {
    data.value = await api('/dashboard');
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  }
});
const date = (v: string) =>
  new Date(v).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <div v-if="data" class="stack">
    <section class="hero-card">
      <div>
        <p class="eyebrow">PRIMARY PATIENT</p>
        <h2>{{ data.profile.fullName || '请完善患者姓名' }}</h2>
        <p>{{ data.profile.diagnosisSummary || '补充确诊信息后，这里会形成稳定的病情摘要。' }}</p>
      </div>
      <RouterLink class="button secondary" to="/profile">完善档案</RouterLink>
    </section>
    <div class="notice safe-notice">
      <span>盾</span>
      <div>
        <strong>共同决策，不替代医生</strong>
        <p>系统会整理证据与偏好，但不会自动启停、替换或调整药物。</p>
      </div>
    </div>
    <div class="metrics">
      <article>
        <p>进行中的用药计划</p>
        <strong>{{ data.activePlans.length }}</strong
        ><small>均须关联已确认医嘱</small>
      </article>
      <article>
        <p>最近心电记录</p>
        <strong>{{ data.recentEcgs.length }}</strong
        ><small>{{ data.recentEcgs[0]?.classificationOriginal || '尚无设备分类' }}</small>
      </article>
      <article class="trend-card">
        <p>近期记录趋势</p>
        <LineSpark
          :values="data.recentVitals.map((x: any) => Number(x.valueNumeric)).reverse()"
        /><small>仅展示已录入的生命体征</small>
      </article>
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">COURSE</p>
            <h2>最近病程</h2>
          </div>
          <RouterLink to="/timeline">查看全部 →</RouterLink>
        </div>
        <div v-if="data.recentTimeline.length" class="timeline-mini">
          <article v-for="item in data.recentTimeline" :key="item.id">
            <time>{{ date(item.occurredAt) }}</time>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>
        <EmptyState v-else title="从第一条病程开始" text="记录一次就诊、症状变化或检查。" />
      </section>
      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">NEXT STEP</p>
            <h2>建议下一步</h2>
          </div>
        </div>
        <div class="action-list">
          <RouterLink to="/documents"
            ><span>01</span>
            <div>
              <strong>导入最新报告</strong>
              <p>PDF 或清晰照片，解析后逐项确认</p>
            </div></RouterLink
          >
          <RouterLink to="/sources"
            ><span>02</span>
            <div>
              <strong>标记建议来源</strong>
              <p>把医生医嘱与网络科普明确分开</p>
            </div></RouterLink
          >
          <RouterLink to="/assistant"
            ><span>03</span>
            <div>
              <strong>准备复诊问题</strong>
              <p>让本地模型基于已确认资料生成清单</p>
            </div></RouterLink
          >
        </div>
      </section>
    </div>
  </div>
</template>
