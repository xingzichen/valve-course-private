<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, post } from '../api';
import EmptyState from '../components/EmptyState.vue';
import SourceBadge from '../components/SourceBadge.vue';

const orders = ref<any[]>([]),
  sources = ref<any[]>([]),
  open = ref(false),
  message = ref(''),
  decision = ref<any>(null),
  decisionOrder = ref<any>(null),
  plans = ref<any[]>([]),
  planOpen = ref(false);
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const form = reactive<any>({
  orderedAt: localNow(),
  doctorName: null,
  hospital: null,
  department: null,
  originalText: '',
  purpose: null,
  status: 'PENDING_CONFIRMATION',
  sourceId: '',
  options: [
    {
      name: '华法林',
      medicationName: '华法林',
      instructions: null,
      conditions: null,
      risks: null,
      monitoring: '需按医嘱监测 INR'
    },
    {
      name: '利伐沙班',
      medicationName: '利伐沙班',
      instructions: null,
      conditions: null,
      risks: null,
      monitoring: null
    }
  ]
});
const ds = reactive<any>({
  clinicalFacts: {
    rheumaticMitralStenosis: null,
    moderateOrSevereMitralStenosis: null,
    atrialFibrillation: null,
    mechanicalValve: null
  },
  preferences: {
    canAttendRegularInrMonitoring: null,
    canKeepDietAndMedicationRoutineStable: null,
    acceptsDoseAdjustments: null,
    stronglyPrefersNoRoutineBloodTests: null,
    adherenceConfidence: null,
    primaryConcern: null
  }
});
const choice = reactive<any>({
  selectedOptionId: '',
  choiceRationale: '',
  doctorConfirmed: false,
  doctorConfirmationNote: null
});
const planForm = reactive<any>({
  medicalOrderId: '',
  genericName: '',
  dose: '',
  frequency: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: null
});
async function load() {
  [orders.value, sources.value, plans.value] = await Promise.all([
    api<any[]>('/orders'),
    api<any[]>('/sources'),
    api<any[]>('/medication-plans')
  ]);
}
async function save() {
  message.value = '';
  try {
    await post('/orders', { ...form, orderedAt: new Date(form.orderedAt).toISOString() });
    open.value = false;
    form.originalText = '';
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '保存失败';
  }
}
async function evaluate(order: any) {
  decisionOrder.value = order;
  decision.value = null;
  try {
    decision.value = await post(`/orders/${order.id}/decision-support`, ds);
  } catch (e) {
    message.value = e instanceof Error ? e.message : '分析失败';
  }
}
async function recordChoice() {
  if (!decisionOrder.value) return;
  try {
    await post(`/orders/${decisionOrder.value.id}/choice`, choice);
    message.value = choice.doctorConfirmed
      ? '选择及医生确认已记录。'
      : '选择已记录为“待医生确认”，不会建立服药计划。';
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '记录失败';
  }
}
async function createPlan() {
  const order = orders.value.find((item) => item.id === planForm.medicalOrderId);
  if (!order) return;
  try {
    const medication = await post<any>('/medications', {
      genericName: planForm.genericName,
      brandName: null,
      dosageForm: null,
      sourceId: order.sourceId
    });
    await post('/medication-plans', {
      medicationId: medication.id,
      medicalOrderId: planForm.medicalOrderId,
      dose: planForm.dose,
      frequency: planForm.frequency,
      startDate: planForm.startDate,
      endDate: planForm.endDate || null
    });
    message.value = '服药计划已建立，并保留到已确认医嘱的追溯关系。';
    planOpen.value = false;
    planForm.genericName = '';
    planForm.dose = '';
    planForm.frequency = '';
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '建立计划失败';
  }
}
const boolOptions = [
  { v: null, t: '待确认' },
  { v: true, t: '是' },
  { v: false, t: '否' }
];
onMounted(load);
</script>
<template>
  <div class="page-actions">
    <p>保留医生原话、备选方案和最终确认状态。</p>
    <button class="primary" @click="open = !open">＋ 录入医嘱</button>
  </div>
  <div class="notice caution-notice">
    <span>Rx</span>
    <div>
      <strong>选择建议 ≠ 换药指令</strong>
      <p>系统先检查医学适用性，再比较生活方式；结果只能带回经治医生确认。</p>
    </div>
  </div>
  <form v-if="open" class="panel form-grid" @submit.prevent="save">
    <label class="span-2"
      ><span>医嘱来源 *</span
      ><select v-model="form.sourceId" required>
        <option disabled value="">选择一条“经治医生对本人医嘱”</option>
        <option
          v-for="s in sources.filter(
            (x) => x.sourceType === 'TREATING_DOCTOR_ORDER' && x.isPatientSpecific
          )"
          :key="s.id"
          :value="s.id"
        >
          {{ s.title }}
        </option></select
      ><small
        v-if="!sources.some((x) => x.sourceType === 'TREATING_DOCTOR_ORDER' && x.isPatientSpecific)"
        >请先在“来源”中新建经治医生医嘱来源。</small
      ></label
    >
    <label><span>医嘱时间</span><input v-model="form.orderedAt" type="datetime-local" /></label
    ><label
      ><span>确认状态</span
      ><select v-model="form.status">
        <option value="PENDING_CHOICE">待选择</option>
        <option value="PENDING_CONFIRMATION">待医生确认</option>
        <option value="ACTIVE">已确认生效</option>
        <option value="COMPLETED">已完成</option>
      </select></label
    >
    <label><span>医生</span><input v-model="form.doctorName" /></label
    ><label><span>医院</span><input v-model="form.hospital" /></label>
    <label class="span-2"
      ><span>医生原话 *</span><textarea v-model="form.originalText" required rows="4" /></label
    ><label class="span-2"
      ><span>目的 / 讨论背景</span><textarea v-model="form.purpose" rows="2" />
    </label>
    <div class="span-2 option-grid">
      <article v-for="(o, i) in form.options" :key="i">
        <label
          ><span>方案 {{ Number(i) + 1 }}</span
          ><input v-model="o.name" /></label
        ><label><span>监测要求</span><input v-model="o.monitoring" /></label>
      </article>
    </div>
    <p v-if="message" class="error span-2">{{ message }}</p>
    <div class="form-actions span-2">
      <button type="button" class="quiet" @click="open = false">取消</button
      ><button class="primary">保存医嘱</button>
    </div>
  </form>
  <section class="panel medication-summary">
    <div class="section-head">
      <div>
        <p class="eyebrow">MEDICATION</p>
        <h2>当前服药计划</h2>
      </div>
      <button class="secondary" @click="planOpen = !planOpen">＋ 根据已确认医嘱建立</button>
    </div>
    <form v-if="planOpen" class="form-grid inline-form" @submit.prevent="createPlan">
      <label class="span-2"
        ><span>已确认生效的医嘱</span
        ><select v-model="planForm.medicalOrderId" required>
          <option value="" disabled>请选择</option>
          <option
            v-for="o in orders.filter((item) => item.status === 'ACTIVE')"
            :key="o.id"
            :value="o.id"
          >
            {{ o.purpose || o.originalText }}
          </option></select
        ><small v-if="!orders.some((item) => item.status === 'ACTIVE')"
          >尚无经医生确认生效的医嘱，不能建立计划。</small
        ></label
      >
      <label><span>通用药名</span><input v-model="planForm.genericName" required /></label
      ><label
        ><span>剂量</span
        ><input v-model="planForm.dose" required placeholder="忠实填写医生确认剂量" /></label
      ><label><span>频次</span><input v-model="planForm.frequency" required /></label
      ><label
        ><span>开始日期</span><input v-model="planForm.startDate" type="date" required
      /></label>
      <div class="form-actions span-2">
        <button type="button" class="quiet" @click="planOpen = false">取消</button
        ><button class="primary">建立计划</button>
      </div>
    </form>
    <div v-if="plans.length" class="plan-strip">
      <article v-for="p in plans" :key="p.id">
        <span class="pill-icon">Rx</span>
        <div>
          <strong>{{ p.medication.genericName }} · {{ p.dose }}</strong>
          <p>{{ p.frequency }} · 自 {{ p.startDate }} · {{ p.status }}</p>
        </div>
      </article>
    </div>
    <EmptyState v-else title="尚无服药计划" text="只有医生已确认的个体医嘱才能生成计划。" />
  </section>
  <div class="two-col orders-layout">
    <section class="panel">
      <div class="section-head">
        <h2>医嘱记录</h2>
        <span>{{ orders.length }} 条</span>
      </div>
      <div v-if="orders.length" class="card-list">
        <article
          v-for="o in orders"
          :key="o.id"
          class="order-card"
          :class="decisionOrder?.id === o.id ? 'selected' : ''"
        >
          <div class="row-between">
            <SourceBadge
              :type="o.source.sourceType"
              :patient-specific="o.source.isPatientSpecific"
            /><span class="status">{{ o.status }}</span>
          </div>
          <h3>{{ o.purpose || '医疗方案记录' }}</h3>
          <blockquote>{{ o.originalText }}</blockquote>
          <p>
            {{ o.doctorName || '医生未记录' }} · {{ o.hospital || '医院未记录' }} ·
            {{ new Date(o.orderedAt).toLocaleDateString('zh-CN') }}
          </p>
          <div class="chips">
            <span v-for="x in o.options" :key="x.id">{{ x.name }}</span>
          </div>
          <button class="secondary" @click="decisionOrder = o">比较已给出的方案</button>
        </article>
      </div>
      <EmptyState v-else title="尚无医嘱" text="先建立来源，再忠实录入医生原话。" />
    </section>
    <section v-if="decisionOrder" class="panel sticky-panel">
      <p class="eyebrow">SHARED DECISION</p>
      <h2>方案讨论准备</h2>
      <p class="muted">针对：{{ decisionOrder.purpose || decisionOrder.originalText }}</p>
      <div class="compact-form">
        <h3>临床硬门槛</h3>
        <label
          v-for="field in [
            ['rheumaticMitralStenosis', '风湿性二尖瓣狭窄'],
            ['moderateOrSevereMitralStenosis', '中重度狭窄'],
            ['atrialFibrillation', '存在房颤'],
            ['mechanicalValve', '存在机械瓣']
          ]"
          :key="field[0]"
          ><span>{{ field[1] }}</span
          ><select v-model="ds.clinicalFacts[field[0]]">
            <option v-for="x in boolOptions" :key="String(x.v)" :value="x.v">{{ x.t }}</option>
          </select></label
        >
        <h3>生活习惯与心理偏好</h3>
        <label
          v-for="field in [
            ['canAttendRegularInrMonitoring', '能规律监测 INR'],
            ['canKeepDietAndMedicationRoutineStable', '饮食与服药节律稳定'],
            ['acceptsDoseAdjustments', '能接受按结果调量'],
            ['stronglyPrefersNoRoutineBloodTests', '强烈希望避免常规抽血']
          ]"
          :key="field[0]"
          ><span>{{ field[1] }}</span
          ><select v-model="ds.preferences[field[0]]">
            <option v-for="x in boolOptions" :key="String(x.v)" :value="x.v">{{ x.t }}</option>
          </select></label
        ><label
          ><span>依从性信心</span
          ><select v-model="ds.preferences.adherenceConfidence">
            <option :value="null">待确认</option>
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
          </select></label
        ><label
          ><span>最关心</span
          ><select v-model="ds.preferences.primaryConcern">
            <option :value="null">待确认</option>
            <option value="SAFETY">安全性</option>
            <option value="CONVENIENCE">便利性</option>
            <option value="COST">费用</option>
            <option value="UNCERTAIN">还不确定</option>
          </select></label
        ><button class="primary wide" @click="evaluate(decisionOrder)">生成透明比较</button>
      </div>
      <div v-if="decision" class="decision-result">
        <p class="scope">{{ decision.scope }}</p>
        <article v-for="x in decision.eligibility" :key="x.option">
          <div class="row-between">
            <strong>{{ x.option === 'WARFARIN' ? '华法林' : '利伐沙班' }}</strong
            ><span class="status" :class="x.status.toLowerCase()">{{ x.status }}</span>
          </div>
          <p v-for="r in x.reasons" :key="r">{{ r }}</p>
          <small v-if="x.missingData.length">待确认：{{ x.missingData.join('、') }}</small>
        </article>
        <h3>
          讨论倾向：{{
            decision.suggestedDiscussionOption === 'WARFARIN'
              ? '华法林'
              : decision.suggestedDiscussionOption === 'RIVAROXABAN'
                ? '利伐沙班'
                : '暂不生成'
          }}
        </h3>
        <p v-for="r in decision.rationale" :key="r">{{ r }}</p>
        <div class="notice safe-notice">
          <span>→</span>
          <p>{{ decision.nextAction }}</p>
        </div>
        <form class="compact-form choice-form" @submit.prevent="recordChoice">
          <h3>记录最终选择</h3>
          <label
            ><span>选择方案</span
            ><select v-model="choice.selectedOptionId" required>
              <option value="" disabled>请选择</option>
              <option v-for="o in decisionOrder.options" :key="o.id" :value="o.id">
                {{ o.name }}
              </option>
            </select></label
          ><label
            ><span>选择理由（含生活习惯与心理偏好）</span
            ><textarea v-model="choice.choiceRationale" rows="3" required /></label
          ><label class="check"
            ><input v-model="choice.doctorConfirmed" type="checkbox" /><span
              >经治医生已确认这一选择</span
            ></label
          ><label v-if="choice.doctorConfirmed"
            ><span>医生确认记录</span
            ><textarea
              v-model="choice.doctorConfirmationNote"
              rows="2"
              placeholder="确认时间、医生原话或复诊记录"
            /></label
          ><button class="secondary wide">保存选择状态</button>
        </form>
      </div>
    </section>
  </div>
</template>
