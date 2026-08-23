<script setup lang="ts">
import Button from 'primevue/button';

import type { CompetencyGroupSnapshot } from '../ui/competencies-page';
import CompetencyRow from './CompetencyRow.vue';

defineOptions({ name: 'CompetencyGroup' });

const props = defineProps<{
  group: CompetencyGroupSnapshot;
  draggedCompetencyId?: string;
  activeDropGroupKey?: string;
  dropTargetId?: string;
  dropAfter: boolean;
}>();

const emit = defineEmits<{
  (event: 'toggle', groupId: string): void;
  (event: 'create-subgroup', groupId: string): void;
  (event: 'edit', groupId: string): void;
  (event: 'remove', groupId: string): void;
  (event: 'create-competency', groupId: string): void;
  (event: 'edit-competency', competencyId: string): void;
  (event: 'remove-competency', competencyId: string): void;
  (event: 'drag-start', competencyId: string, dragEvent: DragEvent): void;
  (event: 'drag-over', groupId: string, targetId: string | undefined, afterTarget: boolean, dragEvent: DragEvent): void;
  (event: 'drop', groupId: string, targetId: string | undefined, afterTarget: boolean, dragEvent: DragEvent): void;
  (event: 'drag-end'): void;
}>();

const isActiveDropGroup = (): boolean => props.activeDropGroupKey === props.group.id;
</script>

<template>
  <section
    class="group-card"
    :class="`depth-${Math.min(group.depth, 2)}`"
  >
    <div
      class="group-header"
      :class="{ 'drop-active': isActiveDropGroup() && !dropTargetId }"
      @dragover.prevent.stop="emit('drag-over', group.id, undefined, false, $event)"
      @drop.prevent.stop="emit('drop', group.id, undefined, false, $event)"
    >
      <Button
        unstyled
        class="collapse-button"
        :class="{ open: !group.collapsed }"
        :aria-label="group.collapsed ? `Déplier ${group.name}` : `Replier ${group.name}`"
        @click="emit('toggle', group.id)"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="m9 18 6-6-6-6" /></svg></span>
      </Button>
      <div class="group-title">
        <strong>{{ group.name }}</strong>
        <span>{{ group.competencyCount }} compétence{{ group.competencyCount > 1 ? 's' : '' }}</span>
      </div>
      <div class="group-actions">
        <Button
          unstyled
          class="quiet-button"
          @click="emit('create-subgroup', group.id)"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 5v14M5 12h14" /></svg></span>
          Sous-groupe
        </Button>
        <Button
          unstyled
          class="icon-button subtle"
          :aria-label="`Modifier ${group.name}`"
          @click="emit('edit', group.id)"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></span>
        </Button>
        <Button
          unstyled
          class="icon-button subtle danger"
          :aria-label="`Supprimer ${group.name}`"
          @click="emit('remove', group.id)"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></svg></span>
        </Button>
      </div>
    </div>
    <div
      v-if="!group.collapsed"
      class="group-content"
      :class="{ 'drop-active': isActiveDropGroup() && !dropTargetId }"
      @dragover.prevent.stop="emit('drag-over', group.id, undefined, false, $event)"
      @drop.prevent.stop="emit('drop', group.id, undefined, false, $event)"
    >
      <CompetencyRow
        v-for="competency in group.competencies"
        :key="competency.id"
        :item="competency"
        :dragging="draggedCompetencyId === competency.id"
        :drop-position="dropTargetId === competency.id ? (dropAfter ? 'after' : 'before') : undefined"
        @edit="emit('edit-competency', $event)"
        @remove="emit('remove-competency', $event)"
        @drag-start="(id, event) => emit('drag-start', id, event)"
        @drag-over="(id, after, event) => emit('drag-over', group.id, id, after, event)"
        @drop="(id, after, event) => emit('drop', group.id, id, after, event)"
        @drag-end="emit('drag-end')"
      />
      <CompetencyGroup
        v-for="child in group.children"
        :key="child.id"
        :group="child"
        :dragged-competency-id="draggedCompetencyId"
        :active-drop-group-key="activeDropGroupKey"
        :drop-target-id="dropTargetId"
        :drop-after="dropAfter"
        @toggle="emit('toggle', $event)"
        @create-subgroup="emit('create-subgroup', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
        @create-competency="emit('create-competency', $event)"
        @edit-competency="emit('edit-competency', $event)"
        @remove-competency="emit('remove-competency', $event)"
        @drag-start="(id, event) => emit('drag-start', id, event)"
        @drag-over="(groupId, id, after, event) => emit('drag-over', groupId, id, after, event)"
        @drop="(groupId, id, after, event) => emit('drop', groupId, id, after, event)"
        @drag-end="emit('drag-end')"
      />
      <Button
        unstyled
        class="add-competency-inline"
        @click="emit('create-competency', group.id)"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M12 5v14M5 12h14" /></svg></span>
        Ajouter une compétence
      </Button>
    </div>
  </section>
</template>
