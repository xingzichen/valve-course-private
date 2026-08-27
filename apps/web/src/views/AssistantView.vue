<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { api, post } from '../api';
import EmptyState from '../components/EmptyState.vue';
const analyses = ref<any[]>([]),
  question = ref(
    '请根据已确认的病程、检查、医嘱和用药记录，整理下次复诊最值得询问医生的 5 个问题。'
  ),
  type = ref('VISIT_PREPARATION'),
  message = ref('');
const urgentSymptoms = reactive({
  chestPain: false,
  syncope: false,
  severeDyspnea: false,
  strokeSigns: false,
  majorBleeding: false,
  persistentFastHeartRate: false
});
const hasUrgentSymptoms = computed(() => Object.values(urgentSymptoms).some(Boolean));
let timer: number | undefined;
async function load() {
  analyses.value = await api('/ai/analyses');
}
async function submit() {
  message.value = '';
  try {
    await post('/ai/analyses', {
      analysisType: type.value,
      question: question.value,
      urgentSymptoms
    });
    message.value = hasUrgentSymptoms.value
      ? '已由确定性安全规则处理，未等待模型分析。'
      : '已提交到本地模型，通常需要几十秒到数分钟。';
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '提交失败';
  }
}
function printAnalysis() {
  window.print();
}
onMounted(async () => {
  await load();
  timer = window.setInterval(load, 5000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>
<template>
  <div class="notice safe-notice">
    <span>✦</span>
    <div>
      <strong>本地模型，可解释地辅助思考</strong>
      <p>只读取 NAS 中的档案；回答会区分经治医生医嘱、科普、设备数据和 AI 推断。</p>
    </div>
  </div>
  <div class="assistant-layout">
    <form class="panel ask-card" @submit.prevent="submit">
      <p class="eyebrow">ASK WITH CONTEXT</p>
      <h2>想一起梳理什么？</h2>
      <label
        ><span>任务</span
        ><select v-model="type">
          <option value="VISIT_PREPARATION">准备复诊</option>
          <option value="COURSE_SUMMARY">总结病程</option>
          <option value="MEDICATION_DISCUSSION">用药共同决策</option>
          <option value="SOURCE_REVIEW">核验网络科普</option>
          <option value="SECOND_OPINION_COMPARISON">比较第二意见</option>
          <option value="GENERAL_QUESTION">一般问题</option>
        </select></label
      >
      <fieldset class="urgent-check">
        <legend>提交前安全检查</legend>
        <p>如当前存在以下任一表现，请勾选。系统会绕过 AI，立即给出就医提示。</p>
        <label><input v-model="urgentSymptoms.chestPain" type="checkbox" />胸痛/胸部压迫感</label>
        <label><input v-model="urgentSymptoms.syncope" type="checkbox" />晕厥/意识丧失</label>
        <label
          ><input v-model="urgentSymptoms.severeDyspnea" type="checkbox" />严重或突发呼吸困难</label
        >
        <label><input v-model="urgentSymptoms.strokeSigns" type="checkbox" />疑似卒中表现</label>
        <label
          ><input
            v-model="urgentSymptoms.majorBleeding"
            type="checkbox"
          />大量/无法止住的出血</label
        >
        <label
          ><input
            v-model="urgentSymptoms.persistentFastHeartRate"
            type="checkbox"
          />持续快速心率且明显不适</label
        >
      </fieldset>
      <div v-if="hasUrgentSymptoms" class="notice urgent-notice">
        <strong>不要等待 AI：请立即联系 120 或尽快前往急诊。</strong>
      </div>
      <label><span>问题</span><textarea v-model="question" rows="8" required /></label
      ><button class="primary wide">交给本地 Qwen 分析</button
      ><small>不会自动执行医疗动作；如资料不足，会列出待确认项。</small>
    </form>
    <section class="panel">
      <div class="section-head">
        <h2>分析记录</h2>
        <button class="quiet" @click="load">刷新</button>
      </div>
      <div v-if="analyses.length" class="analysis-list">
        <article v-for="a in analyses" :key="a.id">
          <div class="row-between">
            <span class="badge">{{ a.analysisType }}</span
            ><span class="status">{{ a.status }}</span>
          </div>
          <h3>{{ a.question }}</h3>
          <div v-if="a.answer" class="answer">{{ a.answer }}</div>
          <button v-if="a.status === 'COMPLETED'" class="quiet print-button" @click="printAnalysis">
            打印 / 保存为 PDF
          </button>
          <p v-if="a.errorMessage" class="error">{{ a.errorMessage }}</p>
          <details v-if="a.citations?.length">
            <summary>查看 {{ a.citations.length }} 条证据引用</summary>
            <ul>
              <li v-for="c in a.citations" :key="c.ref">
                <code>{{ c.ref }}</code> {{ c.statement }} <small>{{ c.sourceType }}</small>
              </li>
            </ul>
          </details>
          <time>{{ new Date(a.createdAt).toLocaleString('zh-CN') }}</time>
        </article>
      </div>
      <EmptyState v-else title="还没有分析" text="可先让助手为复诊生成一份问题清单。" />
    </section>
  </div>
</template>
