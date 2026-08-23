<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import type { EvaluationsPageSnapshot } from '../ui/evaluations-page';

const props = defineProps<{
  snapshot: EvaluationsPageSnapshot;
}>();

const emit = defineEmits<{
  (event: 'search', value: string): void;
  (event: 'select-subject', subjectId: string): void;
  (event: 'mount-grid', element: HTMLElement): void;
  (event: 'unmount-grid'): void;
}>();

const gridHost = ref<HTMLElement>();
const updateSearch = (value: string | undefined): void => emit('search', value ?? '');

const mountGrid = async (): Promise<void> => {
  await nextTick();
  if (gridHost.value) emit('mount-grid', gridHost.value);
};

onMounted(mountGrid);
watch(() => props.snapshot.gridRevision, mountGrid);
onBeforeUnmount(() => emit('unmount-grid'));
</script>

<template>
  <main class="workspace evaluation-workspace">
    <header class="page-header">
      <div>
        <p class="eyebrow">Suivi des acquis</p>
        <h1>Évaluation</h1>
        <p class="subtitle">Sélectionnez une case, saisissez 1, 2, 9 ou 0, puis naviguez avec les flèches.</p>
      </div>
      <div class="autosave-indicator">
        <span /> Enregistrement automatique
      </div>
    </header>

    <div class="evaluation-tools">
      <label class="search-field">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg></span>
        <InputText
          unstyled
          type="search"
          :model-value="snapshot.search"
          placeholder="Rechercher un élève…"
          aria-label="Rechercher un élève"
          @update:model-value="updateSearch"
        />
      </label>
      <div class="status-legend">
        <span
          v-for="item in snapshot.legend"
          :key="item.className"
          :title="item.label"
        >
          <i class="legend-dot" :class="`status-${item.className}`" />
          <template v-if="item.inputCode"><kbd>{{ item.inputCode }}</kbd> = {{ item.display }}</template>
          <template v-else>À passer</template>
        </span>
      </div>
    </div>

    <div
      class="evaluation-subject-tabs"
      role="tablist"
      aria-label="Choisir une matière"
    >
      <Button
        v-for="subject in snapshot.subjects"
        :key="subject.id"
        unstyled
        role="tab"
        class="evaluation-subject-tab"
        :class="{ active: subject.selected }"
        :aria-selected="subject.selected"
        @click="emit('select-subject', subject.id)"
      >
        <i class="subject-dot" :class="`color-${subject.colorIndex}`" />
        <span>{{ subject.name }}</span>
        <b>{{ subject.competencyCount }}</b>
      </Button>
    </div>

    <section class="evaluation-grid-card">
      <div class="grid-help">
        <strong>{{ snapshot.selectedSubjectName }}</strong>
        <span>{{ snapshot.totalStudentCount }} élèves</span>
        <span>{{ snapshot.selectedCompetencyCount }} compétence{{ snapshot.selectedCompetencyCount > 1 ? 's' : '' }}</span>
        <span>Flèches : déplacer · 1/2/9/0 : noter</span>
      </div>
      <div
        ref="gridHost"
        class="evaluation-grid"
      />
    </section>
  </main>
</template>
