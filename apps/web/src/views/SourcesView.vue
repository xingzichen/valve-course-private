<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, post } from '../api';
import EmptyState from '../components/EmptyState.vue';
import SourceBadge from '../components/SourceBadge.vue';

const sources = ref<any[]>([]);
const open = ref(false);
const message = ref('');
const types = [
  ['TREATING_DOCTOR_ORDER', '经治医生对本人的医嘱'],
  ['PERSONALIZED_SECOND_OPINION', '个体化第二意见'],
  ['DOCTOR_EXPLANATION', '医生讲解'],
  ['MEDICAL_GUIDELINE', '医学指南'],
  ['DRUG_LABEL', '药品说明书'],
  ['ONLINE_EDUCATION', '网络医生科普'],
  ['PATIENT_EXPERIENCE', '患者经验'],
  ['USER_INFERENCE', '个人推测'],
  ['DEVICE_DATA', '设备数据'],
  ['UNKNOWN', '尚未核实']
];
const form = reactive<any>({
  sourceType: 'TREATING_DOCTOR_ORDER',
  title: '',
  authorName: null,
  organization: null,
  platform: null,
  url: null,
  isPatientSpecific: true,
  originalQuote: null
});
async function load() {
  sources.value = await api('/sources');
}
async function save() {
  message.value = '';
  try {
    await post('/sources', form);
    open.value = false;
    form.title = '';
    form.originalQuote = null;
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '保存失败';
  }
}
onMounted(load);
</script>
<template>
  <div class="page-actions">
    <p>每一条建议都先回答“谁在什么场景下说的”。</p>
    <button class="primary" @click="open = !open">＋ 新增来源</button>
  </div>
  <div class="notice caution-notice">
    <span>!</span>
    <div>
      <strong>网络科普不是医嘱</strong>
      <p>公开视频通常面向泛人群，可能省略前提和禁忌；可用于理解和提问，不能直接建立服药计划。</p>
    </div>
  </div>
  <form v-if="open" class="panel form-grid" @submit.prevent="save">
    <label class="span-2"
      ><span>来源类型</span
      ><select
        v-model="form.sourceType"
        @change="form.isPatientSpecific = form.sourceType === 'TREATING_DOCTOR_ORDER'"
      >
        <option v-for="t in types" :key="t[0]" :value="t[0]">{{ t[1] }}</option>
      </select></label
    >
    <label class="span-2"
      ><span>标题 *</span
      ><input v-model="form.title" required placeholder="例：8 月 12 日心内科复诊医嘱"
    /></label>
    <label><span>医生 / 作者</span><input v-model="form.authorName" /></label
    ><label><span>医院 / 机构</span><input v-model="form.organization" /></label>
    <label
      ><span>平台</span
      ><input v-model="form.platform" placeholder="例：门诊、抖音、公众号" /></label
    ><label><span>链接</span><input v-model="form.url" type="url" /></label>
    <label class="check span-2"
      ><input v-model="form.isPatientSpecific" type="checkbox" /><span
        >这是针对患者本人的个体化内容</span
      ></label
    >
    <label class="span-2"
      ><span>原话 / 原文摘要</span><textarea v-model="form.originalQuote" rows="4" />
    </label>
    <p v-if="message" class="error span-2">{{ message }}</p>
    <div class="form-actions span-2">
      <button type="button" class="quiet" @click="open = false">取消</button
      ><button class="primary">保存来源</button>
    </div>
  </form>
  <section class="panel">
    <div class="section-head">
      <h2>来源档案</h2>
      <span>{{ sources.length }} 条</span>
    </div>
    <div v-if="sources.length" class="card-list">
      <article v-for="item in sources" :key="item.id" class="source-row">
        <div>
          <SourceBadge :type="item.sourceType" :patient-specific="item.isPatientSpecific" />
          <h3>{{ item.title }}</h3>
          <p>
            {{
              [item.authorName, item.organization, item.platform].filter(Boolean).join(' · ') ||
              '未补充作者信息'
            }}
          </p>
          <blockquote v-if="item.originalQuote">{{ item.originalQuote }}</blockquote>
        </div>
        <time>{{ new Date(item.capturedAt).toLocaleDateString('zh-CN') }}</time>
      </article>
    </div>
    <EmptyState v-else title="还没有来源" text="先添加一条经治医生医嘱或资料来源。" />
  </section>
</template>
