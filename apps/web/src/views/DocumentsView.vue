<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, patch, post } from '../api';
import EmptyState from '../components/EmptyState.vue';

const typeLabels: Record<string, string> = {
  ECG_PDF: '心电图（含 Apple Watch）',
  AFIB_HISTORY_PDF: '房颤历史',
  MEDICATION_LIST: '用药清单',
  ECHO_REPORT: '心脏超声',
  LAB_REPORT: '化验报告',
  PRESCRIPTION: '处方与医嘱',
  OUTPATIENT_RECORD: '门诊记录',
  DISCHARGE_SUMMARY: '出院记录',
  OTHER: '待自动分类'
};
const statusLabels: Record<string, string> = {
  UPLOADED: '等待入队',
  QUEUED: '排队识别',
  PROCESSING: 'AI 识别中',
  REVIEW_REQUIRED: '等待核对',
  CONFIRMED: '已核对',
  FAILED: '识别失败'
};
const abnormalLabels: Record<string, string> = {
  HIGH: '偏高',
  LOW: '偏低',
  ABNORMAL: '异常',
  CRITICAL: '危急标记',
  NORMAL: '正常',
  UNKNOWN: '未判断'
};

const route = useRoute();
const router = useRouter();
const documents = ref<any[]>([]);
const selected = ref<any>(null);
const extraction = ref<any>(null);
const files = ref<File[]>([]);
const category = ref('ALL');
const message = ref('');
const uploading = ref(false);
let pollTimer: number | undefined;

const categories = computed(() => {
  const counts = new Map<string, number>();
  for (const document of documents.value) {
    counts.set(document.documentType, (counts.get(document.documentType) ?? 0) + 1);
  }
  return [...counts.entries()];
});
const filteredDocuments = computed(() =>
  category.value === 'ALL'
    ? documents.value
    : documents.value.filter((document) => document.documentType === category.value)
);
const queuedDocuments = computed(() =>
  filteredDocuments.value.filter((document) => !document.documentedAt)
);
const timelineDocuments = computed(() =>
  filteredDocuments.value
    .filter((document) => document.documentedAt)
    .sort(
      (left, right) =>
        new Date(right.documentedAt).getTime() - new Date(left.documentedAt).getTime()
    )
);
const latestRun = computed(() => extraction.value?.runs?.[0] ?? null);

function reportTime(document: any): string {
  if (!document.documentedAt) return '报告时间待识别';
  return new Date(document.documentedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: document.datePrecision === 'DATE' ? undefined : '2-digit',
    minute: document.datePrecision === 'DATE' ? undefined : '2-digit'
  });
}

function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  files.value = Array.from(input.files ?? []).slice(0, 12);
}

async function load() {
  documents.value = await api('/documents?limit=200');
  if (selected.value) {
    selected.value = documents.value.find((item) => item.id === selected.value.id) ?? null;
  }
}

async function upload() {
  if (!files.value.length) return;
  uploading.value = true;
  message.value = '';
  let uploaded = 0;
  let duplicates = 0;
  try {
    for (const item of files.value) {
      const data = new FormData();
      data.append('file', item);
      const result = await api<any>('/documents/upload', { method: 'POST', body: data });
      if (result.duplicate) duplicates += 1;
      else uploaded += 1;
      selected.value = result.document;
    }
    files.value = [];
    message.value = `${uploaded} 份文件已上传并自动进入识别队列${duplicates ? `，${duplicates} 份重复文件已打开原记录` : ''}。`;
    await load();
    if (selected.value) await inspect(selected.value);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '上传失败';
  } finally {
    uploading.value = false;
  }
}

async function inspect(document: any, updateUrl = true) {
  selected.value = document;
  extraction.value = await api(`/documents/${document.id}/extraction`);
  selected.value = extraction.value.document;
  if (updateUrl) await router.replace({ query: { document: document.id } });
}

async function analyze() {
  if (!selected.value) return;
  try {
    await post(`/documents/${selected.value.id}/analyze`, {});
    message.value = '已重新进入本地模型识别队列。';
    await load();
    await inspect(selected.value, false);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '提交失败';
  }
}

async function verify(fact: any, status: string) {
  await patch(`/documents/facts/${fact.id}/verification`, {
    status,
    valueText: fact.valueText
  });
  await load();
  await inspect(selected.value, false);
}

async function poll() {
  if (!documents.value.some((item) => ['UPLOADED', 'QUEUED', 'PROCESSING'].includes(item.status)))
    return;
  await load();
  if (selected.value && ['UPLOADED', 'QUEUED', 'PROCESSING'].includes(selected.value.status)) {
    await inspect(selected.value, false);
  }
}

onMounted(async () => {
  await load();
  const id = typeof route.query.document === 'string' ? route.query.document : null;
  const initial = documents.value.find((item) => item.id === id);
  if (initial) await inspect(initial, false);
  pollTimer = window.setInterval(() => void poll(), 3000);
});
onBeforeUnmount(() => window.clearInterval(pollTimer));
</script>

<template>
  <div class="page-actions">
    <p>选择或拍摄文件后自动分类、识别和分析；不需要预先判断报告类型。</p>
  </div>
  <section class="upload-zone upload-auto">
    <div>
      <strong>拍摄或选择医疗文件</strong>
      <p>支持 Apple Watch ECG PDF、PDF、JPEG、PNG、HEIC；可一次选择 12 份。</p>
    </div>
    <label class="button secondary file-button">
      选择文件
      <input
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
        @change="chooseFiles"
      />
    </label>
    <label class="button secondary file-button">
      拍摄报告
      <input type="file" accept="image/*" capture="environment" @change="chooseFiles" />
    </label>
    <span v-if="files.length">已选择 {{ files.length }} 份</span>
    <button class="primary" :disabled="!files.length || uploading" @click="upload">
      {{ uploading ? '正在安全上传…' : '上传并自动识别' }}
    </button>
  </section>
  <p v-if="message" class="feedback">{{ message }}</p>

  <div class="document-filters" aria-label="自动分类筛选">
    <button :class="category === 'ALL' ? 'active' : ''" @click="category = 'ALL'">
      全部 {{ documents.length }}
    </button>
    <button
      v-for="entry in categories"
      :key="entry[0]"
      :class="category === entry[0] ? 'active' : ''"
      @click="category = entry[0]"
    >
      {{ typeLabels[entry[0]] || entry[0] }} {{ entry[1] }}
    </button>
  </div>

  <div class="two-col docs-layout">
    <section class="panel">
      <div v-if="queuedDocuments.length" class="recognition-queue">
        <div class="section-head">
          <div>
            <p class="eyebrow">AI QUEUE</p>
            <h2>自动识别队列</h2>
          </div>
          <span>{{ queuedDocuments.length }} 份</span>
        </div>
        <p>识别完成并取得报告日期后，文件会自动进入下方医疗时间线。</p>
        <div class="recognition-queue-list">
          <button
            v-for="document in queuedDocuments"
            :key="document.id"
            :class="selected?.id === document.id ? 'selected' : ''"
            @click="inspect(document)"
          >
            <strong>{{ document.originalFilename }}</strong>
            <span :class="['status', `status-${document.status.toLowerCase()}`]">
              {{ statusLabels[document.status] || document.status }}
            </span>
          </button>
        </div>
      </div>

      <div class="section-head">
        <div>
          <p class="eyebrow">MEDICAL TIMELINE</p>
          <h2>病例与报告时间线</h2>
        </div>
        <span>{{ timelineDocuments.length }} 份</span>
      </div>
      <div v-if="timelineDocuments.length" class="document-timeline">
        <article v-for="document in timelineDocuments" :key="document.id">
          <div class="document-time">
            <span></span>
            <time>{{ reportTime(document) }}</time>
          </div>
          <button
            :class="selected?.id === document.id ? 'selected' : ''"
            @click="inspect(document)"
          >
            <div class="row-between">
              <span class="badge">{{
                typeLabels[document.documentType] || document.documentType
              }}</span>
              <span :class="['status', `status-${document.status.toLowerCase()}`]">
                {{ statusLabels[document.status] || document.status }}
              </span>
            </div>
            <strong>{{ document.title || document.originalFilename }}</strong>
            <p>{{ document.summary || document.originalFilename }}</p>
            <small>{{ document.facility || '来源待识别' }} · {{ document.originalFilename }}</small>
          </button>
        </article>
      </div>
      <EmptyState
        v-else
        title="还没有带报告日期的记录"
        text="文件识别出检查、采样、开具或就诊时间后，会自动按该时间归档。"
      />
    </section>

    <section v-if="selected" class="panel sticky-panel document-detail">
      <div class="row-between detail-heading">
        <div>
          <p class="eyebrow">{{ typeLabels[selected.documentType] || selected.documentType }}</p>
          <h2>{{ selected.title || selected.originalFilename }}</h2>
          <small>{{ reportTime(selected) }} · {{ selected.facility || '机构待识别' }}</small>
        </div>
        <span :class="['status', `status-${selected.status.toLowerCase()}`]">
          {{ statusLabels[selected.status] || selected.status }}
        </span>
      </div>
      <div class="row-actions">
        <a class="button secondary" :href="`/api/v1/documents/${selected.id}/file`" target="_blank">
          查看原件
        </a>
        <button v-if="selected.status === 'FAILED'" class="primary" @click="analyze">
          重新识别
        </button>
        <button class="quiet" @click="inspect(selected)">刷新</button>
      </div>

      <div
        v-if="['UPLOADED', 'QUEUED', 'PROCESSING'].includes(selected.status)"
        class="recognition-progress"
      >
        <span class="spinner"></span>
        <div>
          <strong>{{ statusLabels[selected.status] }}</strong>
          <p>后台正在自动读取文档；可离开本页，完成后会归入报告时间线。</p>
        </div>
      </div>
      <div v-else-if="selected.status === 'FAILED'" class="notice urgent-notice">
        <span>!</span>
        <div>
          <strong>本次识别未完成</strong>
          <p>{{ latestRun?.errorMessage || '本地模型暂时无法处理该文件，请重试。' }}</p>
        </div>
      </div>

      <div v-if="selected.summary" class="detail-section">
        <h3>识别摘要</h3>
        <p>{{ selected.summary }}</p>
      </div>

      <div v-if="selected.aiAdvice" class="advice-card">
        <p class="eyebrow">AI 针对性提示</p>
        <p>{{ selected.aiAdvice.overview }}</p>
        <div v-if="selected.aiAdvice.urgentWarning" class="notice urgent-notice">
          <span>!</span>
          <p>{{ selected.aiAdvice.urgentWarning }}</p>
        </div>
        <div v-if="selected.aiAdvice.keyFindings?.length" class="advice-findings">
          <article v-for="finding in selected.aiAdvice.keyFindings" :key="finding.label">
            <strong>{{ finding.label }}</strong>
            <p>{{ finding.explanation }}</p>
          </article>
        </div>
        <div class="advice-columns">
          <div v-if="selected.aiAdvice.followUpActions?.length">
            <strong>下一步</strong>
            <ul>
              <li v-for="item in selected.aiAdvice.followUpActions" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div v-if="selected.aiAdvice.questionsForDoctor?.length">
            <strong>建议向医生确认</strong>
            <ul>
              <li v-for="item in selected.aiAdvice.questionsForDoctor" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
        <small>{{ selected.aiAdvice.limitations?.join('；') }}</small>
      </div>

      <div class="notice caution-notice">
        <span>!</span>
        <p>模型识别可能出错。药名、剂量、诊断、INR、超声参数和 ECG 分类必须对照原件确认。</p>
      </div>

      <div v-if="selected.warnings?.length" class="document-warnings">
        <strong>识别提醒</strong>
        <ul>
          <li v-for="warning in selected.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>

      <div v-if="extraction?.facts?.length" class="fact-list">
        <div class="section-head">
          <h3>识别出的内容</h3>
          <span>{{ extraction.facts.length }} 项</span>
        </div>
        <article v-for="fact in extraction.facts" :key="fact.id">
          <div class="row-between">
            <label>
              <span>{{ fact.label }}</span>
              <input v-model="fact.valueText" />
            </label>
            <div class="fact-badges">
              <span
                v-if="fact.abnormalFlag !== 'UNKNOWN'"
                :class="['badge', `flag-${fact.abnormalFlag.toLowerCase()}`]"
              >
                {{ abnormalLabels[fact.abnormalFlag] }}
              </span>
              <span v-if="fact.highRisk" class="badge badge-caution">需重点核对</span>
            </div>
          </div>
          <small>
            {{ fact.unit || '无单位' }}
            <template v-if="fact.referenceRange"> · 参考 {{ fact.referenceRange }}</template>
            · 第 {{ fact.pageNumber || 1 }} 页 · 置信度 {{ fact.confidence ?? '—' }}
          </small>
          <p v-if="fact.originalText" class="original-quote">原文：{{ fact.originalText }}</p>
          <div class="row-actions">
            <button class="accept" @click="verify(fact, 'CONFIRMED')">✓ 核对无误</button>
            <button class="reject" @click="verify(fact, 'REJECTED')">× 识别错误</button>
            <span class="status">{{ fact.verificationStatus }}</span>
          </div>
        </article>
      </div>
      <EmptyState
        v-else-if="!['UPLOADED', 'QUEUED', 'PROCESSING', 'FAILED'].includes(selected.status)"
        title="没有可确认字段"
        text="请查看识别摘要与原件；模糊内容不会被模型猜测补全。"
      />
    </section>
  </div>
</template>
