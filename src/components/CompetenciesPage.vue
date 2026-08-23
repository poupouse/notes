<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { ref } from 'vue';

import type { CompetenciesPageSnapshot } from '../ui/competencies-page';
import CompetencyGroup from './CompetencyGroup.vue';
import CompetencyRow from './CompetencyRow.vue';

defineProps<{
  snapshot: CompetenciesPageSnapshot;
}>();

const emit = defineEmits<{
  (event: 'search', value: string): void;
  (event: 'select-subject', subjectId: string): void;
  (event: 'create-subject'): void;
  (event: 'edit-subject', subjectId: string): void;
  (event: 'create-group', parentGroupId?: string): void;
  (event: 'edit-group', groupId: string): void;
  (event: 'toggle-group', groupId: string): void;
  (event: 'remove-group', groupId: string): void;
  (event: 'create-competency', groupId?: string): void;
  (event: 'edit-competency', competencyId: string): void;
  (event: 'remove-competency', competencyId: string): void;
  (event: 'move-competency', competencyId: string, groupId: string | undefined, targetId?: string, afterTarget?: boolean): void;
}>();

const draggedCompetencyId = ref<string>();
const activeDropGroupKey = ref<string>();
const dropTargetId = ref<string>();
const dropAfter = ref(false);

const updateSearch = (value: string | undefined): void => emit('search', value ?? '');

const clearDrag = (): void => {
  draggedCompetencyId.value = undefined;
  activeDropGroupKey.value = undefined;
  dropTargetId.value = undefined;
  dropAfter.value = false;
};

const startDrag = (competencyId: string, event: DragEvent): void => {
  draggedCompetencyId.value = competencyId;
  event.dataTransfer?.setData('text/plain', competencyId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
};

const dragOver = (
  groupId: string | undefined,
  targetId: string | undefined,
  afterTarget: boolean,
  event: DragEvent,
): void => {
  if (!draggedCompetencyId.value) return;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  activeDropGroupKey.value = groupId ?? '';
  dropTargetId.value = targetId;
  dropAfter.value = afterTarget;
};

const drop = (
  groupId: string | undefined,
  targetId: string | undefined,
  afterTarget: boolean,
): void => {
  if (draggedCompetencyId.value) {
    emit('move-competency', draggedCompetencyId.value, groupId, targetId, afterTarget);
  }
  clearDrag();
};
</script>

<template>
  <main class="workspace">
    <header class="page-header">
      <div>
        <p class="eyebrow">Référentiel pédagogique</p>
        <h1>Compétences</h1>
        <p class="subtitle">Organisez votre référentiel par matière et par domaine.</p>
      </div>
      <Button
        unstyled
        class="primary-button"
        :disabled="!snapshot.selectedSubject"
        @click="emit('create-competency')"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M12 5v14M5 12h14" /></svg></span>
        Nouvelle compétence
      </Button>
    </header>

    <div class="page-tools">
      <label class="search-field">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg></span>
        <InputText
          unstyled
          type="search"
          :model-value="snapshot.search"
          placeholder="Rechercher une compétence ou un numéro…"
          aria-label="Rechercher une compétence ou un numéro"
          @update:model-value="updateSearch"
        />
      </label>
      <div class="summary-chip">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg></span>
        {{ snapshot.selectedCompetencyCount }} compétences
      </div>
    </div>

    <div class="competency-layout">
      <aside class="subject-rail">
        <div class="rail-heading">
          <span>Matières</span>
          <Button
            unstyled
            class="icon-button"
            title="Ajouter"
            aria-label="Ajouter une matière"
            @click="emit('create-subject')"
          >
            <span class="icon"><svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="M12 5v14M5 12h14" /></svg></span>
          </Button>
        </div>
        <div class="subject-list">
          <div
            v-for="subject in snapshot.subjects"
            :key="subject.id"
            class="subject-row"
            :class="{ selected: subject.selected }"
          >
            <Button
              unstyled
              class="subject-button"
              @click="emit('select-subject', subject.id)"
            >
              <i class="subject-dot" :class="`color-${subject.colorIndex}`" />
              <span>{{ subject.name }}</span>
              <b>{{ subject.competencyCount }}</b>
            </Button>
            <Button
              unstyled
              class="row-edit"
              title="Renommer"
              :aria-label="`Renommer ${subject.name}`"
              @click="emit('edit-subject', subject.id)"
            >
              <span class="icon"><svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></span>
            </Button>
          </div>
        </div>
        <Button
          unstyled
          class="text-button rail-add"
          @click="emit('create-subject')"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 5v14M5 12h14" /></svg></span>
          Nouvelle matière
        </Button>
      </aside>

      <div class="tree-panel">
        <template v-if="snapshot.selectedSubject">
          <div class="tree-heading">
            <div>
              <span class="breadcrumb">Matières / {{ snapshot.selectedSubject.name }}</span>
              <h2>{{ snapshot.selectedSubject.name }}</h2>
            </div>
            <Button
              unstyled
              class="secondary-button"
              @click="emit('create-group')"
            >
              <span class="icon"><svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 5v14M5 12h14" /></svg></span>
              Nouveau groupe
            </Button>
          </div>
          <div class="tree-list">
            <CompetencyGroup
              v-for="group in snapshot.selectedSubject.groups"
              :key="group.id"
              :group="group"
              :dragged-competency-id="draggedCompetencyId"
              :active-drop-group-key="activeDropGroupKey"
              :drop-target-id="dropTargetId"
              :drop-after="dropAfter"
              @toggle="emit('toggle-group', $event)"
              @create-subgroup="emit('create-group', $event)"
              @edit="emit('edit-group', $event)"
              @remove="emit('remove-group', $event)"
              @create-competency="emit('create-competency', $event)"
              @edit-competency="emit('edit-competency', $event)"
              @remove-competency="emit('remove-competency', $event)"
              @drag-start="startDrag"
              @drag-over="dragOver"
              @drop="(groupId, targetId, afterTarget) => drop(groupId, targetId, afterTarget)"
              @drag-end="clearDrag"
            />
            <section
              v-if="snapshot.selectedSubject.ungrouped.length"
              class="group-card ungrouped"
            >
              <div
                class="group-header"
                :class="{ 'drop-active': activeDropGroupKey === '' && !dropTargetId }"
                @dragover.prevent.stop="dragOver(undefined, undefined, false, $event)"
                @drop.prevent.stop="drop(undefined, undefined, false)"
              >
                <div class="group-title">
                  <strong>Sans groupe</strong>
                  <span>{{ snapshot.selectedSubject.ungrouped.length }} compétence{{ snapshot.selectedSubject.ungrouped.length > 1 ? 's' : '' }}</span>
                </div>
              </div>
              <div
                class="group-content"
                :class="{ 'drop-active': activeDropGroupKey === '' && !dropTargetId }"
                @dragover.prevent.stop="dragOver(undefined, undefined, false, $event)"
                @drop.prevent.stop="drop(undefined, undefined, false)"
              >
                <CompetencyRow
                  v-for="competency in snapshot.selectedSubject.ungrouped"
                  :key="competency.id"
                  :item="competency"
                  :dragging="draggedCompetencyId === competency.id"
                  :drop-position="dropTargetId === competency.id ? (dropAfter ? 'after' : 'before') : undefined"
                  @edit="emit('edit-competency', $event)"
                  @remove="emit('remove-competency', $event)"
                  @drag-start="startDrag"
                  @drag-over="(id, after, event) => dragOver(undefined, id, after, event)"
                  @drop="(id, after) => drop(undefined, id, after)"
                  @drag-end="clearDrag"
                />
              </div>
            </section>
            <div
              v-if="!snapshot.selectedSubject.groups.length && !snapshot.selectedSubject.ungrouped.length"
              class="empty-state"
            >
              <span class="icon"><svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg></span>
              <h3>Une page encore blanche</h3>
              <p>Créez un groupe ou ajoutez votre première compétence.</p>
              <Button
                unstyled
                class="primary-button"
                @click="emit('create-group')"
              >
                <span class="icon"><svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                ><path d="M12 5v14M5 12h14" /></svg></span>
                Créer un groupe
              </Button>
            </div>
          </div>
        </template>
        <div
          v-else
          class="empty-state"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg></span>
          <h3>Ajoutez une matière</h3>
          <p>Les compétences seront organisées dans vos matières.</p>
          <Button
            unstyled
            class="primary-button"
            @click="emit('create-subject')"
          >
            <span class="icon"><svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><path d="M12 5v14M5 12h14" /></svg></span>
            Nouvelle matière
          </Button>
        </div>
      </div>
    </div>
  </main>
</template>
