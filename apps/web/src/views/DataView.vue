<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, post } from '../api';
import EmptyState from '../components/EmptyState.vue';
import LineSpark from '../components/LineSpark.vue';
const vitals = ref<any[]>([]),
  ecgs = ref<any[]>([]),
  tab = ref('vitals'),
  message = ref('');
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const vital = reactive<any>({
  vitalType: 'HEART_RATE',
  valueNumeric: 70,
  unit: 'bpm',
  observedAt: localNow(),
  sourceId: null,
  notes: null
});
const ecg = reactive<any>({
  healthkitUuid: null,
  recordedAt: localNow(),
  sourceFormat: 'APPLE_ECG_PDF',
  classificationOriginal: null,
  averageHeartRate: null,
  symptomsStatus: null,
  samplingFrequency: null,
  sampleCount: null,
  appleAlgorithmVersion: null,
  documentId: null,
  sourceId: null,
  userNotes: null
});
async function load() {
  [vitals.value, ecgs.value] = await Promise.all([api<any[]>('/vitals'), api<any[]>('/ecg')]);
}
async function addVital() {
  await post('/vitals', { ...vital, observedAt: new Date(vital.observedAt).toISOString() });
  message.value = '指标已保存';
  await load();
}
async function addEcg() {
  await post('/ecg', { ...ecg, recordedAt: new Date(ecg.recordedAt).toISOString() });
  message.value = 'ECG 元数据已保存；请在报告页上传对应 PDF。';
  await load();
}
function setUnit() {
  const units: any = {
    HEART_RATE: 'bpm',
    BLOOD_PRESSURE_SYSTOLIC: 'mmHg',
    BLOOD_PRESSURE_DIASTOLIC: 'mmHg',
    WEIGHT: 'kg',
    SPO2: '%',
    TEMPERATURE: '°C',
    INR: 'ratio',
    OTHER: ''
  };
  vital.unit = units[vital.vitalType];
}
onMounted(load);
</script>
<template>
  <div class="page-actions">
    <p>设备分类、用户感受和医生判读分别保存，避免混为一个结论。</p>
    <div class="tabs">
      <button :class="tab === 'vitals' ? 'active' : ''" @click="tab = 'vitals'">生命体征</button
      ><button :class="tab === 'ecg' ? 'active' : ''" @click="tab = 'ecg'">Apple ECG</button>
    </div>
  </div>
  <p v-if="message" class="feedback">{{ message }}</p>
  <div v-if="tab === 'vitals'" class="two-col">
    <form class="panel compact-form" @submit.prevent="addVital">
      <p class="eyebrow">QUICK ENTRY</p>
      <h2>记录指标</h2>
      <label
        ><span>指标</span
        ><select v-model="vital.vitalType" @change="setUnit">
          <option value="HEART_RATE">心率</option>
          <option value="BLOOD_PRESSURE_SYSTOLIC">收缩压</option>
          <option value="BLOOD_PRESSURE_DIASTOLIC">舒张压</option>
          <option value="WEIGHT">体重</option>
          <option value="SPO2">血氧</option>
          <option value="INR">INR</option>
          <option value="OTHER">其他</option>
        </select></label
      >
      <div class="field-pair">
        <label
          ><span>数值</span
          ><input v-model.number="vital.valueNumeric" type="number" step="any" required /></label
        ><label><span>单位</span><input v-model="vital.unit" required /></label>
      </div>
      <label><span>时间</span><input v-model="vital.observedAt" type="datetime-local" /></label
      ><label><span>备注</span><textarea v-model="vital.notes" rows="3" /></label
      ><button class="primary wide">保存指标</button>
    </form>
    <section class="panel">
      <div class="section-head"><h2>最近趋势</h2></div>
      <LineSpark :values="vitals.map((x) => Number(x.valueNumeric)).reverse()" />
      <div v-if="vitals.length" class="table-list">
        <div v-for="v in vitals" :key="v.id">
          <strong>{{ v.vitalType }}</strong
          ><span>{{ v.valueNumeric }} {{ v.unit }}</span
          ><time>{{ new Date(v.observedAt).toLocaleString('zh-CN') }}</time>
        </div>
      </div>
      <EmptyState v-else title="暂无指标" text="可以先记录心率、血压或 INR。" />
    </section>
  </div>
  <div v-else class="two-col">
    <form class="panel compact-form" @submit.prevent="addEcg">
      <p class="eyebrow">APPLE WATCH</p>
      <h2>登记 ECG</h2>
      <label><span>记录时间</span><input v-model="ecg.recordedAt" type="datetime-local" /></label
      ><label
        ><span>Apple 原始分类</span
        ><select v-model="ecg.classificationOriginal">
          <option :value="null">待填写</option>
          <option value="SINUS_RHYTHM">窦性心律</option>
          <option value="ATRIAL_FIBRILLATION">房颤</option>
          <option value="HIGH_HEART_RATE">高心率</option>
          <option value="LOW_HEART_RATE">低心率</option>
          <option value="INCONCLUSIVE">结论不明确</option>
          <option value="POOR_RECORDING">记录质量不佳</option>
        </select></label
      ><label
        ><span>平均心率</span><input v-model.number="ecg.averageHeartRate" type="number" /></label
      ><label
        ><span>当时症状</span
        ><input v-model="ecg.symptomsStatus" placeholder="无症状 / 心悸 / 气短等" /></label
      ><label><span>本人备注</span><textarea v-model="ecg.userNotes" rows="3" /></label
      ><button class="primary wide">保存 ECG 元数据</button
      ><RouterLink class="button secondary wide center" to="/documents">上传 ECG PDF</RouterLink>
    </form>
    <section class="panel">
      <div class="notice caution-notice">
        <span>⌁</span>
        <div>
          <strong>Apple 分类不是医生诊断</strong>
          <p>原始分类保持原样；症状由用户填写，医生判读另行记录。</p>
        </div>
      </div>
      <div v-if="ecgs.length" class="card-list">
        <article v-for="e in ecgs" :key="e.id" class="ecg-row">
          <span class="ecg-wave">⌁</span>
          <div>
            <strong>{{ e.classificationOriginal || '未记录分类' }}</strong>
            <p>
              {{ e.averageHeartRate ? `${e.averageHeartRate} bpm · ` : ''
              }}{{ new Date(e.recordedAt).toLocaleString('zh-CN') }}
            </p>
            <small>{{ e.userNotes }}</small>
          </div>
        </article>
      </div>
      <EmptyState v-else title="暂无 ECG" text="从 Apple 健康导出 PDF 后上传并登记。" />
    </section>
  </div>
</template>
