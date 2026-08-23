<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { startApp } from './app-ui';
import AppSidebar from './components/AppSidebar.vue';
import type { AppPage, AppShellSnapshot, LegacyAppController } from './ui/app-navigation';

const legacyRoot = ref<HTMLElement | null>(null);
const shell = reactive<AppShellSnapshot>({
  page: 'competencies',
  counts: {
    competencies: 0,
    students: 0,
    evaluations: 0,
    dictations: 0,
  },
});
let controller: LegacyAppController | undefined;
let disposed = false;

const navigate = (page: AppPage): void => {
  controller?.navigate(page);
};

onMounted(async () => {
  if (!legacyRoot.value) throw new Error('Legacy application root not found');
  const mountedController = await startApp(legacyRoot.value, {
    onShellChange(snapshot) {
      shell.page = snapshot.page;
      Object.assign(shell.counts, snapshot.counts);
    },
  });
  if (disposed) mountedController.destroy(); else controller = mountedController;
});

onBeforeUnmount(() => {
  disposed = true;
  controller?.destroy();
  controller = undefined;
});
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :page="shell.page"
      :counts="shell.counts"
      @navigate="navigate"
    />
    <div
      ref="legacyRoot"
      class="legacy-workspace-host"
    />
  </div>
</template>
