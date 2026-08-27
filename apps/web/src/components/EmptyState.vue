<script setup lang="ts">
defineProps<{ title: string; text: string }>();
</script>
<template>
  <div class="empty">
    <span class="empty-mark">＋</span><strong>{{ title }}</strong>
    <p>{{ text }}</p>
  </div>
</template>
