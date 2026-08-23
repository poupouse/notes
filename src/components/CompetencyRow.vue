<script setup lang="ts">
import Button from 'primevue/button';

import type { CompetencyItemSnapshot } from '../ui/competencies-page';

defineProps<{
  item: CompetencyItemSnapshot;
  dragging: boolean;
  dropPosition?: 'before' | 'after';
}>();

const emit = defineEmits<{
  (event: 'edit', competencyId: string): void;
  (event: 'remove', competencyId: string): void;
  (event: 'drag-start', competencyId: string, dragEvent: DragEvent): void;
  (event: 'drag-over', competencyId: string, afterTarget: boolean, dragEvent: DragEvent): void;
  (event: 'drop', competencyId: string, afterTarget: boolean, dragEvent: DragEvent): void;
  (event: 'drag-end'): void;
}>();

const dragTitle = (canReorder: boolean): string => canReorder
  ? 'Déplacer la compétence'
  : 'Effacez la recherche pour réorganiser';

const isAfter = (event: DragEvent): boolean => {
  const row = event.currentTarget as HTMLElement;
  return event.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2;
};
</script>

<template>
  <div
    class="competency-row"
    :class="{
      dragging,
      'drop-before': dropPosition === 'before',
      'drop-after': dropPosition === 'after',
    }"
    @dragover.prevent.stop="emit('drag-over', item.id, isAfter($event), $event)"
    @drop.prevent.stop="emit('drop', item.id, isAfter($event), $event)"
  >
    <span
      class="drag-handle"
      :class="{ disabled: !item.canReorder }"
      :draggable="item.canReorder"
      :title="dragTitle(item.canReorder)"
      :aria-label="dragTitle(item.canReorder)"
      tabindex="0"
      @dragstart="emit('drag-start', item.id, $event)"
      @dragend="emit('drag-end')"
    >⠿</span>
    <div class="competency-main">
      <span>{{ item.name }}</span>
      <small>{{ item.nationalEducationNumber }}</small>
    </div>
    <div class="row-actions">
      <Button
        unstyled
        class="icon-button subtle"
        title="Modifier"
        :aria-label="`Modifier ${item.name}`"
        @click="emit('edit', item.id)"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></span>
      </Button>
      <Button
        unstyled
        class="icon-button subtle danger"
        title="Supprimer"
        :aria-label="`Supprimer ${item.name}`"
        @click="emit('remove', item.id)"
      >
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></svg></span>
      </Button>
    </div>
  </div>
</template>
