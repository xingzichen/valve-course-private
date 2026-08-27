<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, patch } from '../api';
const form = reactive<any>({});
const saved = ref('');
const error = ref('');
onMounted(async () => Object.assign(form, await api('/profile')));
async function save() {
  saved.value = '';
  error.value = '';
  try {
    Object.assign(
      form,
      await patch('/profile', {
        fullName: form.fullName || null,
        birthDate: form.birthDate || null,
        sex: form.sex || null,
        bloodType: form.bloodType || null,
        heightCm: form.heightCm || null,
        weightKg: form.weightKg || null,
        allergies: form.allergies || null,
        diagnosisSummary: form.diagnosisSummary || null,
        mitralStenosisCause: form.mitralStenosisCause || null,
        mitralStenosisSeverity: form.mitralStenosisSeverity || null,
        atrialFibrillationStatus: form.atrialFibrillationStatus || null,
        anticoagulationSummary: form.anticoagulationSummary || null,
        emergencyContact: form.emergencyContact ?? {},
        preferences: form.preferences ?? {}
      })
    );
    saved.value = '已保存';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败';
  }
}
</script>
<template>
  <div class="page-actions"><p>稳定事实集中维护；不确定的信息请明确选择“待确认”。</p></div>
  <form class="panel form-grid" @submit.prevent="save">
    <div class="section-title span-2">
      <p class="eyebrow">BASIC</p>
      <h2>基本信息</h2>
    </div>
    <label><span>姓名</span><input v-model="form.fullName" /></label
    ><label><span>出生日期</span><input v-model="form.birthDate" type="date" /></label
    ><label
      ><span>性别</span
      ><select v-model="form.sex">
        <option :value="null">待确认</option>
        <option>女</option>
        <option>男</option>
        <option>其他</option>
      </select></label
    ><label><span>血型</span><input v-model="form.bloodType" /></label
    ><label
      ><span>身高（cm）</span
      ><input v-model.number="form.heightCm" type="number" step="0.1" /></label
    ><label
      ><span>体重（kg）</span><input v-model.number="form.weightKg" type="number" step="0.1"
    /></label>
    <div class="section-title span-2">
      <p class="eyebrow">CLINICAL</p>
      <h2>二尖瓣与抗凝关键事实</h2>
    </div>
    <label class="span-2"
      ><span>诊断摘要</span><textarea v-model="form.diagnosisSummary" rows="3" /></label
    ><label
      ><span>二尖瓣狭窄病因</span
      ><select v-model="form.mitralStenosisCause">
        <option :value="null">待确认</option>
        <option value="RHEUMATIC">风湿性</option>
        <option value="DEGENERATIVE">退行性</option>
        <option value="OTHER">其他</option>
      </select></label
    ><label
      ><span>狭窄严重程度</span
      ><select v-model="form.mitralStenosisSeverity">
        <option :value="null">待确认</option>
        <option value="MILD">轻度</option>
        <option value="MODERATE">中度</option>
        <option value="SEVERE">重度</option>
      </select></label
    ><label
      ><span>房颤状态</span
      ><select v-model="form.atrialFibrillationStatus">
        <option :value="null">待确认</option>
        <option value="NONE_CONFIRMED">尚未确认</option>
        <option value="PAROXYSMAL">阵发性房颤</option>
        <option value="PERSISTENT">持续性房颤</option>
      </select></label
    ><label><span>过敏史</span><input v-model="form.allergies" /></label
    ><label class="span-2"
      ><span>抗凝治疗摘要</span><textarea v-model="form.anticoagulationSummary" rows="3" />
    </label>
    <p v-if="saved" class="success span-2">{{ saved }}</p>
    <p v-if="error" class="error span-2">{{ error }}</p>
    <div class="form-actions span-2"><button class="primary">保存档案</button></div>
  </form>
</template>
