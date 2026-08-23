<script setup lang="ts">
import type { StudentSuccessGroupSnapshot } from '../ui/students-page';

defineOptions({ name: 'StudentSuccessGroup' });

defineProps<{
  group: StudentSuccessGroupSnapshot;
}>();

const rateLabel = (rate: number | null): string => rate === null ? '—' : `${Math.round(rate * 100)} %`;
</script>

<template>
  <section
    class="student-success-group"
    :class="group.children.length ? 'has-children' : `evaluation-group-color-${group.colorIndex}`"
  >
    <div
      class="student-success-cell"
      :class="{ 'student-success-parent-cell': group.children.length }"
    >
      <span>{{ group.name }}</span>
      <strong>{{ rateLabel(group.rate) }}</strong>
    </div>
    <div
      v-if="group.children.length"
      class="student-success-children"
    >
      <StudentSuccessGroup
        v-for="child in group.children"
        :key="child.id"
        :group="child"
      />
    </div>
  </section>
</template>
