<script setup lang="ts">
const props = defineProps<{ type?: string; patientSpecific?: boolean }>();
const labels: Record<string, string> = {
  TREATING_DOCTOR_ORDER: '线下经治医生',
  PERSONALIZED_SECOND_OPINION: '个体化第二意见',
  DOCTOR_EXPLANATION: '医生讲解',
  MEDICAL_GUIDELINE: '医学指南',
  DRUG_LABEL: '药品说明书',
  ONLINE_EDUCATION: '网络科普',
  PATIENT_EXPERIENCE: '患者经验',
  USER_INFERENCE: '个人推测',
  AI_ANALYSIS: 'AI 分析',
  DEVICE_DATA: '设备数据',
  UNKNOWN: '来源待核实'
};
const safe = props.type === 'TREATING_DOCTOR_ORDER' && props.patientSpecific;
</script>

<template>
  <span
    class="badge"
    :class="safe ? 'badge-doctor' : type === 'ONLINE_EDUCATION' ? 'badge-caution' : ''"
    >{{ labels[type ?? 'UNKNOWN'] ?? type }}</span
  >
</template>
