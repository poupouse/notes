<script setup lang="ts">
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

import type { StudentsPageSnapshot } from '../ui/students-page';
import StudentDictationChart from './StudentDictationChart.vue';
import StudentSuccessGroup from './StudentSuccessGroup.vue';

defineProps<{
  snapshot: StudentsPageSnapshot;
}>();

const emit = defineEmits<{
  (event: 'search', value: string): void;
  (event: 'select', studentId: string): void;
  (event: 'create'): void;
  (event: 'edit', studentId: string): void;
  (event: 'remove', studentId: string): void;
  (event: 'add-note', studentId: string): void;
  (event: 'remove-note', studentId: string, noteId: string): void;
  (event: 'export-report'): void;
}>();

const rateLabel = (rate: number | null): string => rate === null ? '—' : `${Math.round(rate * 100)} %`;
const updateSearch = (value: string | undefined): void => emit('search', value ?? '');
</script>

<template>
  <main class="workspace students-workspace">
    <header class="page-header">
      <div>
        <p class="eyebrow">
          Votre classe
        </p>
        <h1>Élèves</h1>
        <p class="subtitle">
          Gardez les informations essentielles et vos observations à portée de main.
        </p>
      </div>
      <div class="page-header-actions">
        <Button
          unstyled
          class="secondary-button"
          :disabled="!snapshot.totalStudentCount"
          @click="emit('export-report')"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></span>
          Exporter le PDF
        </Button>
        <Button
          unstyled
          class="primary-button"
          @click="emit('create')"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 5v14M5 12h14" /></svg></span>
          Nouvel élève
        </Button>
      </div>
    </header>

    <div class="page-tools">
      <label class="search-field">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><circle
          cx="11"
          cy="11"
          r="8"
        /><path d="m21 21-4.35-4.35" /></svg></span>
        <InputText
          unstyled
          type="search"
          :model-value="snapshot.search"
          placeholder="Rechercher un élève…"
          aria-label="Rechercher un élève"
          @update:model-value="updateSearch"
        />
      </label>
      <div class="summary-chip">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle
          cx="9"
          cy="7"
          r="4"
        /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></span>
        {{ snapshot.totalStudentCount }} élèves
      </div>
    </div>

    <div class="students-layout">
      <section class="student-list-panel">
        <div class="list-caption">
          <span>Prénom</span><span>Notes</span>
        </div>
        <div class="student-list">
          <button
            v-for="student in snapshot.students"
            :key="student.id"
            type="button"
            class="student-row"
            :class="{ selected: student.selected }"
            @click="emit('select', student.id)"
          >
            <span
              class="avatar"
              :class="`avatar-${student.avatarColor}`"
            >{{ student.initials }}</span>
            <span class="student-row-name">
              <strong>{{ student.firstName }}</strong>
              <small>{{ student.notePreview }}</small>
            </span>
            <Badge
              unstyled
              class="note-count"
              :class="{ 'has-notes': student.noteCount }"
              :value="student.noteCount"
            />
            <span class="icon"><svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="m9 18 6-6-6-6" /></svg></span>
          </button>
          <div
            v-if="!snapshot.students.length"
            class="empty-state list-empty"
          >
            <span class="icon"><svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><circle
              cx="11"
              cy="11"
              r="8"
            /><path d="m21 21-4.35-4.35" /></svg></span>
            <h3>Aucun résultat</h3>
            <p>Essayez avec un autre prénom.</p>
          </div>
        </div>
      </section>

      <aside
        v-if="snapshot.selected"
        class="student-detail"
      >
        <div class="detail-topbar">
          <span>Fiche élève</span>
          <div>
            <Button
              unstyled
              class="icon-button"
              :aria-label="`Modifier ${snapshot.selected.firstName}`"
              @click="emit('edit', snapshot.selected.id)"
            >
              <span class="icon"><svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></span>
            </Button>
            <Button
              unstyled
              class="icon-button danger"
              :aria-label="`Supprimer ${snapshot.selected.firstName}`"
              @click="emit('remove', snapshot.selected.id)"
            >
              <span class="icon"><svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></svg></span>
            </Button>
          </div>
        </div>
        <div class="student-identity">
          <div
            class="avatar large"
            :class="`avatar-${snapshot.selected.avatarColor}`"
          >
            {{ snapshot.selected.initials }}
          </div>
          <div>
            <h2>{{ snapshot.selected.firstName }}</h2>
            <p>{{ snapshot.selected.notes.length }} note{{ snapshot.selected.notes.length > 1 ? 's' : '' }} personnelle{{ snapshot.selected.notes.length > 1 ? 's' : '' }}</p>
          </div>
        </div>

        <div class="detail-section-heading">
          <div><h3>Réussite par domaine</h3><p>Matières, groupes et sous-groupes</p></div>
        </div>
        <div class="student-success-overview">
          <section
            v-for="subject in snapshot.selected.subjects"
            :key="subject.id"
            class="student-success-subject"
          >
            <div class="student-success-subject-cell">
              <span>{{ subject.name }}</span><strong>{{ rateLabel(subject.rate) }}</strong>
            </div>
            <div
              v-if="subject.groups.length"
              class="student-success-groups"
              :style="{ '--student-success-columns': subject.groups.length }"
            >
              <StudentSuccessGroup
                v-for="group in subject.groups"
                :key="group.id"
                :group="group"
              />
            </div>
          </section>
        </div>

        <div class="detail-section-heading">
          <div><h3>Progression en dictée</h3><p>Résultats sur l’année · échelle de 0 à 100 %</p></div>
        </div>
        <StudentDictationChart
          :student-name="snapshot.selected.firstName"
          :points="snapshot.selected.dictations"
        />

        <div class="detail-section-heading">
          <div><h3>Notes de suivi</h3><p>Observations privées et rappels</p></div>
          <Button
            unstyled
            class="secondary-button compact"
            @click="emit('add-note', snapshot.selected.id)"
          >
            <span class="icon"><svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="M12 5v14M5 12h14" /></svg></span>
            Ajouter
          </Button>
        </div>
        <div class="notes-list">
          <article
            v-for="note in snapshot.selected.notes"
            :key="note.id"
            class="note-card"
          >
            <div class="note-meta">
              <span>{{ note.formattedDate }}</span>
              <Button
                unstyled
                class="icon-button subtle danger"
                aria-label="Supprimer la note"
                @click="emit('remove-note', snapshot.selected.id, note.id)"
              >
                <span class="icon"><svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                ><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></svg></span>
              </Button>
            </div>
            <p>{{ note.text }}</p>
          </article>
          <div
            v-if="!snapshot.selected.notes.length"
            class="notes-empty"
          >
            <span class="icon"><svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m17 3 4 4L11 17l-4 1 1-4Z" /></svg></span>
            <p>Aucune note pour le moment.</p>
            <Button
              unstyled
              class="text-button"
              @click="emit('add-note', snapshot.selected.id)"
            >
              Écrire une première note
            </Button>
          </div>
        </div>
      </aside>
      <aside
        v-else
        class="student-detail empty-detail"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle
          cx="9"
          cy="7"
          r="4"
        /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></span>
        <p>Sélectionnez un élève</p>
      </aside>
    </div>
  </main>
</template>
