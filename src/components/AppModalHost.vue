<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { AppModalRequest } from '../ui/app-modal';
import AppModalField from './AppModalField.vue';

const props = defineProps<{
  request?: AppModalRequest;
  error: string;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'submit', data: FormData): void;
}>();

const form = ref<HTMLFormElement | null>(null);

const closeOnEscape = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || !props.request) return;
  event.preventDefault();
  emit('close');
};

watch(() => props.request, async (request) => {
  window.removeEventListener('keydown', closeOnEscape);
  if (!request) return;
  window.addEventListener('keydown', closeOnEscape);
  await nextTick();
  window.requestAnimationFrame(() => {
    form.value?.querySelector<HTMLElement>('input,textarea,select,button[type="submit"]')
      ?.focus({ preventScroll: true });
  });
});

onBeforeUnmount(() => window.removeEventListener('keydown', closeOnEscape));

const updateVisible = (visible: boolean): void => {
  if (!visible) emit('close');
};

const submit = (event: Event): void => {
  const target = event.currentTarget;
  if (target instanceof HTMLFormElement) emit('submit', new FormData(target));
};
</script>

<template>
  <Dialog
    :visible="Boolean(request)"
    modal
    dismissable-mask
    block-scroll
    :closable="false"
    :draggable="false"
    :show-header="false"
    class="legacy-modal-dialog"
    :pt="{
      mask: { class: 'modal' },
      root: { 'aria-labelledby': 'app-modal-title' },
    }"
    @update:visible="updateVisible"
  >
    <form
      v-if="request"
      ref="form"
      class="modal-card"
      @submit.prevent="submit"
    >
      <div class="modal-header">
        <div>
          <p class="eyebrow">
            {{ request.eyebrow }}
          </p>
          <h2 id="app-modal-title">
            {{ request.title }}
          </h2>
        </div>
        <Button
          unstyled
          type="button"
          class="icon-button"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="m18 6-12 12M6 6l12 12" /></svg></span>
        </Button>
      </div>
      <div class="modal-content">
        <div class="modal-fields">
          <AppModalField
            v-for="(field, index) in request.fields"
            :key="`${field.kind}-${index}`"
            :field="field"
          />
        </div>
        <p class="form-error">
          {{ error }}
        </p>
      </div>
      <div class="modal-actions">
        <Button
          unstyled
          type="button"
          class="secondary-button"
          @click="emit('close')"
        >
          Annuler
        </Button>
        <Button
          unstyled
          class="primary-button"
          :class="{ 'destructive-button': request.destructive }"
          type="submit"
        >
          {{ request.submit }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>
