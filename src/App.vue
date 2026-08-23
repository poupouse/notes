<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { startApp } from './app-ui';

const legacyRoot = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (!legacyRoot.value) throw new Error('Legacy application root not found');
  await startApp(legacyRoot.value);
});
</script>

<template>
  <div ref="legacyRoot" />
</template>
