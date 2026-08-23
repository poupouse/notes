<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';

import { startApp } from './app-ui';
import AppModalHost from './components/AppModalHost.vue';
import AppSidebar from './components/AppSidebar.vue';
import DictationsPage from './components/DictationsPage.vue';
import StudentsPage from './components/StudentsPage.vue';
import type { AppPage, AppShellSnapshot, LegacyAppController } from './ui/app-navigation';
import type { DictationsPageSnapshot } from './ui/dictations-page';
import type { LegacyModalBridge, LegacyModalRequest } from './ui/legacy-modal';
import type { StudentsPageSnapshot } from './ui/students-page';

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
const dictationsSnapshot = shallowRef<DictationsPageSnapshot>();
const studentsSnapshot = shallowRef<StudentsPageSnapshot>();
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

const searchDictations = (value: string): void => controller?.dictations.setSearch(value);
const createDictation = (): void => controller?.dictations.create();
const manageDictationLevels = (): void => controller?.dictations.manageLevels();
const editDictation = (id: string): void => controller?.dictations.edit(id);
const removeDictation = (id: string): void => controller?.dictations.remove(id);
const editDictationResult = (studentId: string, dictationId: string): void =>
  controller?.dictations.editResult(studentId, dictationId);
const searchStudents = (value: string): void => controller?.students.setSearch(value);
const selectStudent = (id: string): void => controller?.students.select(id);
const createStudent = (): void => controller?.students.create();
const editStudent = (id: string): void => controller?.students.edit(id);
const removeStudent = (id: string): void => controller?.students.remove(id);
const addStudentNote = (id: string): void => controller?.students.addNote(id);
const removeStudentNote = (studentId: string, noteId: string): void =>
  controller?.students.removeNote(studentId, noteId);

onMounted(async () => {
  if (!legacyRoot.value) throw new Error('Legacy application root not found');
  const mountedController = await startApp(legacyRoot.value, {
    modal,
    onShellChange(snapshot) {
      shell.page = snapshot.page;
      Object.assign(shell.counts, snapshot.counts);
    },
    onDictationsChange(snapshot) {
      dictationsSnapshot.value = snapshot;
    },
    onStudentsChange(snapshot) {
      studentsSnapshot.value = snapshot;
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
    <DictationsPage
      v-if="shell.page === 'dictations' && dictationsSnapshot"
      :snapshot="dictationsSnapshot"
      @search="searchDictations"
      @create="createDictation"
      @manage-levels="manageDictationLevels"
      @edit="editDictation"
      @remove="removeDictation"
      @edit-result="editDictationResult"
    />
    <StudentsPage
      v-if="shell.page === 'students' && studentsSnapshot"
      :snapshot="studentsSnapshot"
      @search="searchStudents"
      @select="selectStudent"
      @create="createStudent"
      @edit="editStudent"
      @remove="removeStudent"
      @add-note="addStudentNote"
      @remove-note="removeStudentNote"
    />
    <div
      v-show="shell.page !== 'dictations' && shell.page !== 'students'"
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
