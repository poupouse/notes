<script setup lang="ts">
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';

import type { AppModalField } from '../ui/app-modal';

defineOptions({ name: 'AppModalField' });

defineProps<{
  field: AppModalField;
}>();
</script>

<template>
  <label
    v-if="field.kind === 'input'"
    class="form-field"
  >
    <span>{{ field.label }}</span>
    <InputText
      unstyled
      :name="field.name"
      :type="field.inputType ?? 'text'"
      :model-value="field.value"
      :placeholder="field.placeholder"
      :required="field.required"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      autocomplete="off"
    />
    <small v-if="field.help">{{ field.help }}</small>
  </label>
  <label
    v-else-if="field.kind === 'textarea'"
    class="form-field"
  >
    <span>{{ field.label }}</span>
    <Textarea
      unstyled
      :name="field.name"
      :model-value="field.value"
      :placeholder="field.placeholder"
      :required="field.required"
      :rows="field.rows ?? 5"
    />
    <small v-if="field.help">{{ field.help }}</small>
  </label>
  <label
    v-else-if="field.kind === 'select'"
    class="form-field"
  >
    <span>{{ field.label }}</span>
    <select
      :name="field.name"
      :value="field.value"
    >
      <option
        v-for="option in field.options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <small v-if="field.help">{{ field.help }}</small>
  </label>
  <label
    v-else-if="field.kind === 'checkbox'"
    class="checkbox-field"
  >
    <input
      type="checkbox"
      :name="field.name"
      :checked="field.checked"
    >
    <span>{{ field.label }}</span>
  </label>
  <p
    v-else-if="field.kind === 'message'"
    :class="field.className"
  >
    {{ field.text }}
  </p>
  <div
    v-else
    :class="field.className"
  >
    <AppModalField
      v-for="(child, index) in field.fields"
      :key="`${child.kind}-${index}`"
      :field="child"
    />
  </div>
</template>
