<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ values: number[] }>();
const points = computed(() => {
  if (!props.values.length) return '';
  const min = Math.min(...props.values);
  const max = Math.max(...props.values);
  const span = max - min || 1;
  return props.values
    .map(
      (v, i) =>
        `${(i / Math.max(props.values.length - 1, 1)) * 100},${36 - ((v - min) / span) * 30}`
    )
    .join(' ');
});
</script>
<template>
  <svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="趋势图">
    <polyline
      :points="points"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
