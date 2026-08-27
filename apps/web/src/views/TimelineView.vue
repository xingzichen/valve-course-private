<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, post } from '../api';
import EmptyState from '../components/EmptyState.vue';
import SourceBadge from '../components/SourceBadge.vue';

const items = ref<any[]>([]),
  sources = ref<any[]>([]),
  open = ref(false),
  message = ref('');
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const form = reactive<any>({
  eventType: 'SYMPTOM',
  title: '',
  description: null,
  occurredAt: nowLocal(),
  sourceId: null,
  verificationStatus: 'CONFIRMED',
  metadata: {}
});
async function load() {
  [items.value, sources.value] = await Promise.all([
    api<any[]>('/timeline'),
    api<any[]>('/sources')
  ]);
}
async function save() {
  try {
    await post('/timeline', {
      ...form,
      occurredAt: new Date(form.occurredAt).toISOString(),
      sourceId: form.sourceId || null
    });
    open.value = false;
    form.title = '';
    form.description = null;
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '保存失败';
  }
}
onMounted(load);
</script>
<template>
  <div class="page-actions">
    <p>把症状、就诊、检查和用药变化放回同一条时间线上。</p>
    <button class="primary" @click="open = !open">＋ 记录病程</button>
  </div>
  <form v-if="open" class="panel form-grid" @submit.prevent="save">
    <label
      ><span>事件类型</span
      ><select v-model="form.eventType">
        <option value="SYMPTOM">症状变化</option>
        <option value="VISIT">就诊</option>
        <option value="EXAM">检查</option>
        <option value="MEDICATION">用药变化</option>
        <option value="HOSPITALIZATION">住院</option>
        <option value="OTHER">其他</option>
      </select></label
    >
    <label
      ><span>发生时间</span><input v-model="form.occurredAt" type="datetime-local" required
    /></label>
    <label class="span-2"
      ><span>标题</span><input v-model="form.title" required placeholder="一句话说明发生了什么"
    /></label>
    <label class="span-2"
      ><span>详细描述</span
      ><textarea
        v-model="form.description"
        rows="4"
        placeholder="症状持续多久、诱因、缓解方式，以及想在复诊时确认的问题"
      />
    </label>
    <label class="span-2"
      ><span>信息来源</span
      ><select v-model="form.sourceId">
        <option :value="null">本人观察 / 暂无独立来源</option>
        <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select></label
    >
    <p v-if="message" class="error span-2">{{ message }}</p>
    <div class="form-actions span-2">
      <button type="button" class="quiet" @click="open = false">取消</button
      ><button class="primary">保存记录</button>
    </div>
  </form>
  <section class="panel">
    <div v-if="items.length" class="timeline-full">
      <article v-for="item in items" :key="item.id">
        <div class="timeline-dot"></div>
        <time>{{
          new Date(item.occurredAt).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }}</time>
        <div class="timeline-card">
          <div>
            <span class="badge">{{ item.eventType }}</span
            ><SourceBadge
              v-if="item.source"
              :type="item.source.sourceType"
              :patient-specific="item.source.isPatientSpecific"
            />
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </div>
      </article>
    </div>
    <EmptyState v-else title="病程时间线还是空的" text="从最近一次门诊或一个症状变化开始。" />
  </section>
</template>
