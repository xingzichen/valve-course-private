<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, patch, post } from '../api';
import EmptyState from '../components/EmptyState.vue';

const documents = ref<any[]>([]),
  selected = ref<any>(null),
  extraction = ref<any>(null),
  file = ref<File | null>(null),
  type = ref('OTHER'),
  message = ref(''),
  uploading = ref(false);
async function load() {
  documents.value = await api('/documents');
}
async function upload() {
  if (!file.value) return;
  uploading.value = true;
  message.value = '';
  try {
    const data = new FormData();
    data.append('file', file.value);
    const result = await api<any>(`/documents/upload?documentType=${type.value}`, {
      method: 'POST',
      body: data
    });
    message.value = result.duplicate ? '文件已存在，已打开原记录。' : '上传成功。';
    selected.value = result.document;
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '上传失败';
  } finally {
    uploading.value = false;
  }
}
async function inspect(doc: any) {
  selected.value = doc;
  extraction.value = await api(`/documents/${doc.id}/extraction`);
}
async function analyze() {
  if (!selected.value) return;
  try {
    await post(`/documents/${selected.value.id}/analyze`, {});
    message.value = '已进入本地模型解析队列，请稍后刷新。';
    await load();
  } catch (e) {
    message.value = e instanceof Error ? e.message : '提交失败';
  }
}
async function verify(f: any, status: string) {
  await patch(`/documents/facts/${f.id}/verification`, { status, valueText: f.valueText });
  await inspect(selected.value);
}
onMounted(load);
</script>
<template>
  <div class="page-actions"><p>原文件永久保留；模型抽取的字段必须逐项确认。</p></div>
  <section class="upload-zone">
    <div>
      <strong>拖入或选择 PDF / 图片</strong>
      <p>支持 Apple Watch ECG PDF、化验、超声、处方和门诊记录；单文件最大 100 MB。</p>
    </div>
    <select v-model="type">
      <option value="ECG_PDF">Apple ECG PDF</option>
      <option value="ECHO_REPORT">超声报告</option>
      <option value="LAB_REPORT">化验报告</option>
      <option value="PRESCRIPTION">处方 / 医嘱</option>
      <option value="OUTPATIENT_RECORD">门诊记录</option>
      <option value="DISCHARGE_SUMMARY">出院小结</option>
      <option value="OTHER">其他</option></select
    ><label class="button secondary file-button"
      >选择文件<input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null" /></label
    ><span v-if="file">{{ file.name }}</span
    ><button class="primary" :disabled="!file || uploading" @click="upload">
      {{ uploading ? '上传中…' : '安全上传' }}
    </button>
  </section>
  <p v-if="message" class="feedback">{{ message }}</p>
  <div class="two-col docs-layout">
    <section class="panel">
      <div class="section-head">
        <h2>文档库</h2>
        <span>{{ documents.length }} 份</span>
      </div>
      <div v-if="documents.length" class="document-grid">
        <button
          v-for="d in documents"
          :key="d.id"
          :class="selected?.id === d.id ? 'selected' : ''"
          @click="inspect(d)"
        >
          <span class="doc-icon">{{ d.mimeType === 'application/pdf' ? 'PDF' : 'IMG' }}</span>
          <div>
            <strong>{{ d.originalFilename }}</strong>
            <p>{{ d.documentType }} · {{ (Number(d.sizeBytes) / 1024 / 1024).toFixed(1) }} MB</p>
            <span class="status">{{ d.status }}</span>
          </div>
        </button>
      </div>
      <EmptyState v-else title="还没有报告" text="上传第一份 PDF 或清晰照片。" />
    </section>
    <section v-if="selected" class="panel sticky-panel">
      <p class="eyebrow">DOCUMENT REVIEW</p>
      <h2>{{ selected.originalFilename }}</h2>
      <div class="row-actions">
        <a class="button secondary" :href="`/api/v1/documents/${selected.id}/file`" target="_blank"
          >查看原件</a
        ><button class="primary" @click="analyze">用本地模型解析</button
        ><button class="quiet" @click="inspect(selected)">刷新</button>
      </div>
      <div class="notice caution-notice">
        <span>!</span>
        <p>模型识别可能出错。药名、剂量、诊断、INR 与 ECG 分类等高风险字段必须对照原件确认。</p>
      </div>
      <div v-if="extraction?.facts?.length" class="fact-list">
        <article v-for="f in extraction.facts" :key="f.id">
          <div class="row-between">
            <label
              ><span>{{ f.label }}</span
              ><input v-model="f.valueText" /></label
            ><span v-if="f.highRisk" class="badge badge-caution">高风险</span>
          </div>
          <small>{{ f.originalText || '无原文定位' }} · 置信度 {{ f.confidence ?? '—' }}</small>
          <div class="row-actions">
            <button class="accept" @click="verify(f, 'CONFIRMED')">✓ 确认</button
            ><button class="reject" @click="verify(f, 'REJECTED')">× 驳回</button
            ><span class="status">{{ f.verificationStatus }}</span>
          </div>
        </article>
      </div>
      <EmptyState
        v-else
        title="等待结构化结果"
        text="点击解析后，由后台本地模型读取；大文件可能需要几分钟。"
      />
    </section>
  </div>
</template>
