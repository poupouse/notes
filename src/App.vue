<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';

import { startApp } from './app-ui';
import AppModalHost from './components/AppModalHost.vue';
import AppSidebar from './components/AppSidebar.vue';
import type { AppPage, AppShellSnapshot, LegacyAppController } from './ui/app-navigation';
import type { LegacyModalBridge, LegacyModalRequest } from './ui/legacy-modal';

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
const modalRequest = shallowRef<LegacyModalRequest>();
const modalError = ref('');
let controller: LegacyAppController | undefined;
let disposed = false;

const modal: LegacyModalBridge = {
  open(request) {
    modalError.value = '';
    modalRequest.value = request;
  },
  close() {
    modalRequest.value = undefined;
    modalError.value = '';
  },
  setError(message) {
    modalError.value = message;
  },
};

const navigate = (page: AppPage): void => {
  controller?.navigate(page);
};

const submitModal = (data: FormData): void => {
  modalRequest.value?.save(data);
};

onMounted(async () => {
  if (!legacyRoot.value) throw new Error('Legacy application root not found');
  const mountedController = await startApp(legacyRoot.value, {
    modal,
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
  <AppModalHost
    :request="modalRequest"
    :error="modalError"
    @close="modal.close"
    @submit="submitModal"
  />
</template>
