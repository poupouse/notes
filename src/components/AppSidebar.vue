<script setup lang="ts">
import Badge from 'primevue/badge';

import type { AppNavigationCounts, AppPage } from '../ui/app-navigation';

defineProps<{
  page: AppPage;
  counts: AppNavigationCounts;
}>();

const emit = defineEmits<{
  (event: 'navigate', page: AppPage): void;
}>();
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M12 3 10.6 7.2a5 5 0 0 1-3.2 3.2L3 12l4.4 1.6a5 5 0 0 1 3.2 3.2L12 21l1.4-4.2a5 5 0 0 1 3.2-3.2L21 12l-4.4-1.6a5 5 0 0 1-3.2-3.2L12 3Z" /></svg></span>
      </div>
      <div><strong>Carnet</strong><span>Suivi de classe</span></div>
    </div>

    <nav
      class="main-nav"
      aria-label="Espace de travail"
    >
      <p class="nav-label">
        Espace de travail
      </p>
      <button
        class="nav-item"
        :class="{ active: page === 'competencies' }"
        type="button"
        @click="emit('navigate', 'competencies')"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg></span>
        <span>Compétences</span>
        <b><Badge
          :value="counts.competencies"
          class="nav-count"
        /></b>
      </button>
      <button
        class="nav-item"
        :class="{ active: page === 'students' }"
        type="button"
        @click="emit('navigate', 'students')"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle
          cx="9"
          cy="7"
          r="4"
        /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></span>
        <span>Élèves</span>
        <b><Badge
          :value="counts.students"
          class="nav-count"
        /></b>
      </button>
      <button
        class="nav-item"
        :class="{ active: page === 'evaluations' || page === 'dictations' }"
        type="button"
        @click="emit('navigate', 'evaluations')"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
        /><path d="M3 9h18M9 9v11M15 9v11" /></svg></span>
        <span>Évaluation</span>
        <b><Badge
          :value="counts.evaluations"
          class="nav-count"
        /></b>
      </button>
      <button
        class="nav-item nav-subitem"
        :class="{ active: page === 'dictations' }"
        type="button"
        @click="emit('navigate', 'dictations')"
      >
        <span class="nav-branch">↳</span>
        <span>Dictée</span>
        <b><Badge
          :value="counts.dictations"
          class="nav-count"
        /></b>
      </button>
    </nav>

    <div class="sidebar-tip">
      <div>
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M12 3 10.6 7.2a5 5 0 0 1-3.2 3.2L3 12l4.4 1.6a5 5 0 0 1 3.2 3.2L12 21l1.4-4.2a5 5 0 0 1 3.2-3.2L21 12l-4.4-1.6a5 5 0 0 1-3.2-3.2L12 3Z" /></svg></span>
      </div>
      <strong>Tout est enregistré</strong>
      <p>Vos modifications sont sauvegardées automatiquement sur cet appareil.</p>
    </div>
    <div class="profile">
      <div class="avatar small">
        CL
      </div>
      <div><strong>Votre classe</strong><span>Espace professeure</span></div>
      <span>•••</span>
    </div>
  </aside>
</template>
