<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';

import { startApp } from './app-ui';
import AppModalHost from './components/AppModalHost.vue';
import AppSidebar from './components/AppSidebar.vue';
import CompetenciesPage from './components/CompetenciesPage.vue';
import DictationsPage from './components/DictationsPage.vue';
import EvaluationsPage from './components/EvaluationsPage.vue';
import StudentsPage from './components/StudentsPage.vue';
import type { AppController, AppPage, AppShellSnapshot } from './ui/app-navigation';
import type { AppModalBridge, AppModalRequest } from './ui/app-modal';
import type { CompetenciesPageSnapshot } from './ui/competencies-page';
import type { DictationsPageSnapshot } from './ui/dictations-page';
import type { EvaluationsPageSnapshot } from './ui/evaluations-page';
import type { StudentsPageSnapshot } from './ui/students-page';

const shell = reactive<AppShellSnapshot>({
  page: 'competencies',
  counts: {
    competencies: 0,
    students: 0,
    evaluations: 0,
    dictations: 0,
  },
});
const modalRequest = shallowRef<AppModalRequest>();
const competenciesSnapshot = shallowRef<CompetenciesPageSnapshot>();
const dictationsSnapshot = shallowRef<DictationsPageSnapshot>();
const evaluationsSnapshot = shallowRef<EvaluationsPageSnapshot>();
const studentsSnapshot = shallowRef<StudentsPageSnapshot>();
const modalError = ref('');
let controller: AppController | undefined;
let disposed = false;

const modal: AppModalBridge = {
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

const searchCompetencies = (value: string): void => controller?.competencies.setSearch(value);
const selectSubject = (id: string): void => controller?.competencies.selectSubject(id);
const createSubject = (): void => controller?.competencies.createSubject();
const editSubject = (id: string): void => controller?.competencies.editSubject(id);
const createGroup = (parentId?: string): void => controller?.competencies.createGroup(parentId);
const editGroup = (id: string): void => controller?.competencies.editGroup(id);
const toggleGroup = (id: string): void => controller?.competencies.toggleGroup(id);
const removeGroup = (id: string): void => controller?.competencies.removeGroup(id);
const createCompetency = (groupId?: string): void => controller?.competencies.createCompetency(groupId);
const editCompetency = (id: string): void => controller?.competencies.editCompetency(id);
const removeCompetency = (id: string): void => controller?.competencies.removeCompetency(id);
const moveCompetency = (id: string, groupId: string | undefined, targetId?: string, afterTarget?: boolean): void =>
  controller?.competencies.moveCompetency(id, groupId, targetId, afterTarget);
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
const exportStudentReport = (): void => controller?.students.exportReport();
const searchEvaluations = (value: string): void => controller?.evaluations.setSearch(value);
const selectEvaluationSubject = (id: string): void => controller?.evaluations.selectSubject(id);
const mountEvaluationGrid = (element: HTMLElement): void => controller?.evaluations.mountGrid(element);
const unmountEvaluationGrid = (): void => controller?.evaluations.unmountGrid();

onMounted(async () => {
  const mountedController = await startApp({
    modal,
    onShellChange(snapshot) {
      shell.page = snapshot.page;
      Object.assign(shell.counts, snapshot.counts);
    },
    onCompetenciesChange(snapshot) {
      competenciesSnapshot.value = snapshot;
    },
    onDictationsChange(snapshot) {
      dictationsSnapshot.value = snapshot;
    },
    onEvaluationsChange(snapshot) {
      evaluationsSnapshot.value = snapshot;
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
    <CompetenciesPage
      v-if="shell.page === 'competencies' && competenciesSnapshot"
      :snapshot="competenciesSnapshot"
      @search="searchCompetencies"
      @select-subject="selectSubject"
      @create-subject="createSubject"
      @edit-subject="editSubject"
      @create-group="createGroup"
      @edit-group="editGroup"
      @toggle-group="toggleGroup"
      @remove-group="removeGroup"
      @create-competency="createCompetency"
      @edit-competency="editCompetency"
      @remove-competency="removeCompetency"
      @move-competency="moveCompetency"
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
      @export-report="exportStudentReport"
    />
    <EvaluationsPage
      v-if="shell.page === 'evaluations' && evaluationsSnapshot"
      :snapshot="evaluationsSnapshot"
      @search="searchEvaluations"
      @select-subject="selectEvaluationSubject"
      @mount-grid="mountEvaluationGrid"
      @unmount-grid="unmountEvaluationGrid"
    />
  </div>
  <AppModalHost
    :request="modalRequest"
    :error="modalError"
    @close="modal.close"
    @submit="submitModal"
  />
</template>
