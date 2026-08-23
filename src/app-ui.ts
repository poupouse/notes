import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
  type ColDef,
  type ColGroupDef,
  type CellKeyDownEvent,
  type GridApi,
  type GridOptions,
  type IHeaderComp,
  type IHeaderParams,
  type ICellRendererParams,
} from 'ag-grid-community';

import { loadAppState, saveAppState, type AppState } from './app-state';
import { CompetencyStatus } from './domain';
import type { Competency, CompetencyGroup, Dictation, DictationLevel, Student } from './domain';

ModuleRegistry.registerModules([AllCommunityModule]);

type Page = 'competencies' | 'students' | 'evaluations' | 'dictations';

interface EvaluationRow {
  studentId: string;
  studentName: string;
  subjectAverage?: number | null;
  [competencyId: string]: string | number | null | undefined;
}

const svg = (paths: string): string =>
  `<span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg></span>`;

const icons = {
  layers: svg('<path d="m12 3-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>'),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>'),
  chevron: svg('<path d="m9 18 6-6-6-6"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>'),
  note: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m17 3 4 4L11 17l-4 1 1-4Z"/>'),
  close: svg('<path d="m18 6-12 12M6 6l12 12"/>'),
  spark: svg('<path d="m12 3-1.4 4.2a5 5 0 0 1-3.2 3.2L3 12l4.4 1.6a5 5 0 0 1 3.2 3.2L12 21l1.4-4.2a5 5 0 0 1 3.2-3.2L21 12l-4.4-1.6a5 5 0 0 1-3.2-3.2Z"/>'),
  grid: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/>'),
};

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character] ?? character));

interface StatusOption {
  value: CompetencyStatus;
  label: string;
  display: string;
  inputCode: '0' | '1' | '2' | '9' | null;
  className: string;
}

const statusOptions: readonly StatusOption[] = [
  { value: CompetencyStatus.Validated, label: 'Validée', display: 'A', inputCode: '1', className: 'validated' },
  { value: CompetencyStatus.InProgress, label: 'En cours', display: 'PA', inputCode: '2', className: 'in-progress' },
  { value: CompetencyStatus.Failed, label: 'Ratée', display: 'NA', inputCode: '9', className: 'failed' },
  { value: CompetencyStatus.NotTaken, label: 'Non passée', display: 'NE', inputCode: '0', className: 'not-taken' },
  { value: CompetencyStatus.Absent, label: 'Absent', display: '', inputCode: null, className: 'absent' },
];

const evaluationTheme = themeQuartz.withParams({
  accentColor: '#41695a',
  backgroundColor: '#ffffff',
  borderColor: '#e3e3dd',
  borderRadius: 8,
  fontFamily: 'Inter, ui-sans-serif, Segoe UI, sans-serif',
  fontSize: 11,
  foregroundColor: '#353a35',
  headerBackgroundColor: '#f5f6f3',
  headerTextColor: '#58605a',
  rowHoverColor: '#f3f6f4',
  selectedRowBackgroundColor: '#e8f0ec',
  spacing: 3,
});

export const startApp = async (): Promise<void> => {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Application root not found');

  const state: AppState = await loadAppState();
  let dictationDataMigrated = false;
  state.students.forEach((student) => {
    if (student.dictationLevel === undefined) {
      student.dictationLevel = 1;
      dictationDataMigrated = true;
    }
  });
  state.dictations.forEach((dictation) => {
    if (!dictation.wordCountsByLevel) {
      const legacyWordCount = Math.max(1, dictation.totalWords ?? 1);
      dictation.wordCountsByLevel = [legacyWordCount, legacyWordCount, legacyWordCount];
      dictationDataMigrated = true;
    }
    if (!dictation.studentLevels) {
      dictation.studentLevels = Object.fromEntries(state.students.map((student) => [
        student.id,
        student.dictationLevel ?? 1,
      ]));
      dictationDataMigrated = true;
    }
  });
  if (dictationDataMigrated) {
    void saveAppState(state).catch((error: unknown) => {
      console.error('Unable to migrate dictation levels', error);
    });
  }
  let page: Page = 'competencies';
  let selectedSubjectId = state.subjects[0]?.id ?? '';
  let selectedStudentId = state.students[0]?.id ?? '';
  let competencySearch = '';
  let studentSearch = '';
  let evaluationSearch = '';
  let dictationSearch = '';
  let draggedCompetencyId: string | undefined;
  let evaluationSubjectId = state.subjects.find((subject) =>
    state.competencies.some((competency) => competency.subjectId === subject.id))?.id ?? state.subjects[0]?.id ?? '';
  let evaluationGridApi: GridApi<EvaluationRow> | undefined;
  const collapsedGroups = new Set<string>();
  const uid = (prefix: string): string => {
    const randomValues = crypto.getRandomValues(new Uint32Array(2));
    return `${prefix}-${Date.now().toString(36)}-${randomValues[0].toString(36)}${randomValues[1].toString(36)}`;
  };

  const subjectCount = (subjectId: string): number =>
    state.competencies.filter((item) => item.subjectId === subjectId).length;

  const orderedCompetencies = (items: Competency[]): Competency[] => [...items].sort((a, b) => {
    const fallbackA = state.competencies.indexOf(a);
    const fallbackB = state.competencies.indexOf(b);
    const orderA = Number.isFinite(a.sortOrder) ? a.sortOrder as number : fallbackA;
    const orderB = Number.isFinite(b.sortOrder) ? b.sortOrder as number : fallbackB;
    return orderA - orderB || fallbackA - fallbackB;
  });

  const competenciesInGroup = (groupId?: string): Competency[] => orderedCompetencies(
    state.competencies.filter((item) => item.subjectId === selectedSubjectId && item.groupId === groupId),
  );

  const competenciesForSubject = (subjectId: string): Competency[] => {
    const ordered: Competency[] = [];
    const addGroup = (group: CompetencyGroup): void => {
      ordered.push(...orderedCompetencies(state.competencies.filter((item) => item.groupId === group.id)));
      state.groups.filter((child) => child.parentGroupId === group.id).forEach(addGroup);
    };
    state.groups.filter((group) => group.subjectId === subjectId && !group.parentGroupId).forEach(addGroup);
    ordered.push(...orderedCompetencies(state.competencies.filter((item) => item.subjectId === subjectId && !item.groupId)));
    const orderedIds = new Set(ordered.map((item) => item.id));
    ordered.push(...orderedCompetencies(state.competencies.filter((item) => item.subjectId === subjectId && !orderedIds.has(item.id))));
    return ordered;
  };

  const normalizeGroupOrder = (groupId?: string): void => {
    competenciesInGroup(groupId).forEach((item, index) => { item.sortOrder = index; });
  };

  const sidebar = (): string => `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${icons.spark}</div><div><strong>Carnet</strong><span>Suivi de classe</span></div></div>
      <nav class="main-nav"><p class="nav-label">Espace de travail</p>
        <button class="nav-item ${page === 'competencies' ? 'active' : ''}" data-action="navigate" data-page="competencies">${icons.layers}<span>Compétences</span><b>${state.competencies.length}</b></button>
        <button class="nav-item ${page === 'students' ? 'active' : ''}" data-action="navigate" data-page="students">${icons.users}<span>Élèves</span><b>${state.students.length}</b></button>
        <button class="nav-item ${page === 'evaluations' || page === 'dictations' ? 'active' : ''}" data-action="navigate" data-page="evaluations">${icons.grid}<span>Évaluation</span><b>${state.competencyStatuses.length}</b></button>
        <button class="nav-item nav-subitem ${page === 'dictations' ? 'active' : ''}" data-action="navigate" data-page="dictations"><span class="nav-branch">↳</span><span>Dictée</span><b>${state.dictations.length}</b></button>
      </nav>
      <div class="sidebar-tip"><div>${icons.spark}</div><strong>Tout est enregistré</strong><p>Vos modifications sont sauvegardées automatiquement sur cet appareil.</p></div>
      <div class="profile"><div class="avatar small">CL</div><div><strong>Votre classe</strong><span>Espace professeure</span></div><span>•••</span></div>
    </aside>`;

  const subjectRail = (): string => `
    <aside class="subject-rail">
      <div class="rail-heading"><span>Matières</span><button class="icon-button" data-action="new-subject" title="Ajouter">${icons.plus}</button></div>
      <div class="subject-list">${state.subjects.map((subject, index) => `
        <div class="subject-row ${subject.id === selectedSubjectId ? 'selected' : ''}">
          <button class="subject-button" data-action="select-subject" data-id="${subject.id}"><i class="subject-dot color-${index % 5}"></i><span>${escapeHtml(subject.name)}</span><b>${subjectCount(subject.id)}</b></button>
          <button class="row-edit" data-action="edit-subject" data-id="${subject.id}" title="Renommer">${icons.edit}</button>
        </div>`).join('')}</div>
      <button class="text-button rail-add" data-action="new-subject">${icons.plus} Nouvelle matière</button>
    </aside>`;

  const competencyRow = (id: string): string => {
    const item = state.competencies.find((competency) => competency.id === id);
    if (!item) return '';
    const canReorder = !competencySearch.trim();
    const dragTitle = canReorder ? 'Déplacer la compétence' : 'Effacez la recherche pour réorganiser';
    return `<div class="competency-row" data-competency-id="${id}"><span class="drag-handle ${canReorder ? '' : 'disabled'}" draggable="${canReorder}" data-competency-id="${id}" title="${dragTitle}" aria-label="${dragTitle}" tabindex="0">⠿</span><div class="competency-main"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.nationalEducationNumber)}</small></div><div class="row-actions"><button class="icon-button subtle" data-action="edit-competency" data-id="${id}" title="Modifier">${icons.edit}</button><button class="icon-button subtle danger" data-action="delete-competency" data-id="${id}" title="Supprimer">${icons.trash}</button></div></div>`;
  };

  const groupMatches = (group: CompetencyGroup): boolean => {
    const query = competencySearch.trim().toLocaleLowerCase('fr');
    if (!query) return true;
    return group.name.toLocaleLowerCase('fr').includes(query) ||
      state.competencies.some((item) => item.groupId === group.id && `${item.name} ${item.nationalEducationNumber}`.toLocaleLowerCase('fr').includes(query)) ||
      state.groups.filter((child) => child.parentGroupId === group.id).some(groupMatches);
  };

  const groupCard = (group: CompetencyGroup, depth = 0): string => {
    if (!groupMatches(group)) return '';
    const query = competencySearch.trim().toLocaleLowerCase('fr');
    const items = orderedCompetencies(state.competencies.filter((item) => item.groupId === group.id && (!query || `${item.name} ${item.nationalEducationNumber}`.toLocaleLowerCase('fr').includes(query))));
    const children = state.groups.filter((child) => child.parentGroupId === group.id);
    const collapsed = collapsedGroups.has(group.id) && !query;
    const count = state.competencies.filter((item) => item.groupId === group.id).length;
    return `<section class="group-card depth-${Math.min(depth, 2)}">
      <div class="group-header" data-drop-group-id="${group.id}"><button class="collapse-button ${collapsed ? '' : 'open'}" data-action="toggle-group" data-id="${group.id}">${icons.chevron}</button><div class="group-title"><strong>${escapeHtml(group.name)}</strong><span>${count} compétence${count > 1 ? 's' : ''}</span></div><div class="group-actions"><button class="quiet-button" data-action="new-subgroup" data-id="${group.id}">${icons.plus} Sous-groupe</button><button class="icon-button subtle" data-action="edit-group" data-id="${group.id}">${icons.edit}</button><button class="icon-button subtle danger" data-action="delete-group" data-id="${group.id}">${icons.trash}</button></div></div>
      ${collapsed ? '' : `<div class="group-content" data-drop-group-id="${group.id}">${items.map((item) => competencyRow(item.id)).join('')}${children.map((child) => groupCard(child, depth + 1)).join('')}<button class="add-competency-inline" data-action="new-competency" data-group-id="${group.id}">${icons.plus} Ajouter une compétence</button></div>`}
    </section>`;
  };

  const competenciesPage = (): string => {
    const subject = state.subjects.find((item) => item.id === selectedSubjectId);
    const groups = state.groups.filter((group) => group.subjectId === selectedSubjectId && !group.parentGroupId);
    const ungrouped = orderedCompetencies(state.competencies.filter((item) => item.subjectId === selectedSubjectId && !item.groupId));
    return `<main class="workspace">
      <header class="page-header"><div><p class="eyebrow">Référentiel pédagogique</p><h1>Compétences</h1><p class="subtitle">Organisez votre référentiel par matière et par domaine.</p></div><button class="primary-button" data-action="new-competency" ${subject ? '' : 'disabled'}>${icons.plus} Nouvelle compétence</button></header>
      <div class="page-tools"><label class="search-field">${icons.search}<input type="search" data-search="competencies" value="${escapeHtml(competencySearch)}" placeholder="Rechercher une compétence ou un numéro…"></label><div class="summary-chip">${icons.book} ${subjectCount(selectedSubjectId)} compétences</div></div>
      <div class="competency-layout">${subjectRail()}<div class="tree-panel">
        ${subject ? `<div class="tree-heading"><div><span class="breadcrumb">Matières / ${escapeHtml(subject.name)}</span><h2>${escapeHtml(subject.name)}</h2></div><button class="secondary-button" data-action="new-group">${icons.plus} Nouveau groupe</button></div><div class="tree-list">${groups.map((group) => groupCard(group)).join('')}${ungrouped.length ? `<section class="group-card ungrouped"><div class="group-header" data-drop-group-id=""><div class="group-title"><strong>Sans groupe</strong><span>${ungrouped.length} compétence${ungrouped.length > 1 ? 's' : ''}</span></div></div><div class="group-content" data-drop-group-id="">${ungrouped.map((item) => competencyRow(item.id)).join('')}</div></section>` : ''}${!groups.length && !ungrouped.length ? emptyState('Une page encore blanche', 'Créez un groupe ou ajoutez votre première compétence.', 'new-group', 'Créer un groupe') : ''}</div>` : emptyState('Ajoutez une matière', 'Les compétences seront organisées dans vos matières.', 'new-subject', 'Nouvelle matière')}
      </div></div>
    </main>`;
  };

  const emptyState = (title: string, text: string, action: string, label: string): string =>
    `<div class="empty-state">${icons.layers}<h3>${title}</h3><p>${text}</p><button class="primary-button" data-action="${action}">${icons.plus} ${label}</button></div>`;

  const initials = (name: string): string => name.trim().slice(0, 2).toLocaleUpperCase('fr');
  const avatarColor = (name: string): number => [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
  const formatDate = (value: string): string => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

  const studentSuccessRate = (studentId: string, competencies: Competency[]): number | null => {
    const statuses = competencies.map((competency) => state.competencyStatuses.find((item) =>
      item.studentId === studentId && item.competencyId === competency.id)?.status ?? CompetencyStatus.NotTaken);
    const passed = statuses.filter((status) => status !== CompetencyStatus.NotTaken);
    if (!passed.length) return null;
    return passed.filter((status) => status === CompetencyStatus.Validated).length / passed.length;
  };

  const studentSuccessLabel = (value: number | null): string =>
    value === null ? '—' : `${Math.round(value * 100)} %`;

  const groupTreeCompetencies = (groupId: string): Competency[] => {
    const groupIds = new Set<string>();
    const addGroup = (id: string): void => {
      groupIds.add(id);
      state.groups.filter((group) => group.parentGroupId === id).forEach((group) => addGroup(group.id));
    };
    addGroup(groupId);
    return state.competencies.filter((competency) => competency.groupId && groupIds.has(competency.groupId));
  };

  const evaluationGroupColorIndex = (subjectId: string, groupId: string): number => {
    const evaluationGroupIds: string[] = [];
    competenciesForSubject(subjectId).forEach((competency) => {
      if (competency.groupId && !evaluationGroupIds.includes(competency.groupId)) evaluationGroupIds.push(competency.groupId);
    });
    const directIndex = evaluationGroupIds.indexOf(groupId);
    if (directIndex >= 0) return directIndex % 8;
    const descendantIndex = evaluationGroupIds.findIndex((candidateId) => {
      let candidate = state.groups.find((group) => group.id === candidateId);
      while (candidate?.parentGroupId) {
        if (candidate.parentGroupId === groupId) return true;
        candidate = state.groups.find((group) => group.id === candidate?.parentGroupId);
      }
      return false;
    });
    return Math.max(0, descendantIndex) % 8;
  };

  const studentSuccessGroup = (studentId: string, group: CompetencyGroup): string => {
    const children = state.groups.filter((item) => item.parentGroupId === group.id);
    const rate = studentSuccessRate(studentId, groupTreeCompetencies(group.id));
    const colorClass = `evaluation-group-color-${evaluationGroupColorIndex(group.subjectId, group.id)}`;
    return `<section class="student-success-group ${children.length ? 'has-children' : colorClass}">
      <div class="student-success-cell ${children.length ? 'student-success-parent-cell' : ''}"><span>${escapeHtml(group.name)}</span><strong>${studentSuccessLabel(rate)}</strong></div>
      ${children.length ? `<div class="student-success-children">${children.map((child) => studentSuccessGroup(studentId, child)).join('')}</div>` : ''}
    </section>`;
  };

  const studentSuccessOverview = (student: Student): string => `<div class="student-success-overview">
    ${state.subjects.map((subject) => {
      const subjectCompetencies = state.competencies.filter((competency) => competency.subjectId === subject.id);
      const topGroups = state.groups.filter((group) => group.subjectId === subject.id && !group.parentGroupId);
      const ungrouped = subjectCompetencies.filter((competency) => !competency.groupId);
      const subjectRate = studentSuccessRate(student.id, subjectCompetencies);
      const columnCount = topGroups.length + (ungrouped.length ? 1 : 0);
      return `<section class="student-success-subject">
        <div class="student-success-subject-cell"><span>${escapeHtml(subject.name)}</span><strong>${studentSuccessLabel(subjectRate)}</strong></div>
        ${columnCount ? `<div class="student-success-groups" style="--student-success-columns:${columnCount}">${topGroups.map((group) => studentSuccessGroup(student.id, group)).join('')}${ungrouped.length ? `<section class="student-success-group evaluation-group-color-${topGroups.length % 8}"><div class="student-success-cell"><span>Sans groupe</span><strong>${studentSuccessLabel(studentSuccessRate(student.id, ungrouped))}</strong></div></section>` : ''}</div>` : ''}
      </section>`;
    }).join('')}
  </div>`;

  const studentDetail = (student?: Student): string => {
    if (!student) return `<aside class="student-detail empty-detail">${icons.users}<p>Sélectionnez un élève</p></aside>`;
    const notes = [...student.manualNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `<aside class="student-detail">
      <div class="detail-topbar"><span>Fiche élève</span><div><button class="icon-button" data-action="edit-student" data-id="${student.id}">${icons.edit}</button><button class="icon-button danger" data-action="delete-student" data-id="${student.id}">${icons.trash}</button></div></div>
      <div class="student-identity"><div class="avatar large avatar-${avatarColor(student.firstName)}">${escapeHtml(initials(student.firstName))}</div><div><h2>${escapeHtml(student.firstName)}</h2><p>${notes.length} note${notes.length > 1 ? 's' : ''} personnelle${notes.length > 1 ? 's' : ''}</p></div></div>
      <div class="detail-section-heading"><div><h3>Réussite par domaine</h3><p>Matières, groupes et sous-groupes</p></div></div>
      ${studentSuccessOverview(student)}
      <div class="detail-section-heading"><div><h3>Notes de suivi</h3><p>Observations privées et rappels</p></div><button class="secondary-button compact" data-action="new-note" data-id="${student.id}">${icons.plus} Ajouter</button></div>
      <div class="notes-list">${notes.map((note) => `<article class="note-card"><div class="note-meta"><span>${formatDate(note.createdAt)}</span><button class="icon-button subtle danger" data-action="delete-note" data-id="${note.id}" data-student-id="${student.id}">${icons.trash}</button></div><p>${escapeHtml(note.text)}</p></article>`).join('')}${notes.length ? '' : `<div class="notes-empty">${icons.note}<p>Aucune note pour le moment.</p><button class="text-button" data-action="new-note" data-id="${student.id}">Écrire une première note</button></div>`}</div>
    </aside>`;
  };

  const studentsPage = (): string => {
    const query = studentSearch.trim().toLocaleLowerCase('fr');
    const students = [...state.students].filter((student) => student.firstName.toLocaleLowerCase('fr').includes(query)).sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    return `<main class="workspace students-workspace">
      <header class="page-header"><div><p class="eyebrow">Votre classe</p><h1>Élèves</h1><p class="subtitle">Gardez les informations essentielles et vos observations à portée de main.</p></div><button class="primary-button" data-action="new-student">${icons.plus} Nouvel élève</button></header>
      <div class="page-tools"><label class="search-field">${icons.search}<input type="search" data-search="students" value="${escapeHtml(studentSearch)}" placeholder="Rechercher un élève…"></label><div class="summary-chip">${icons.users} ${state.students.length} élèves</div></div>
      <div class="students-layout"><section class="student-list-panel"><div class="list-caption"><span>Prénom</span><span>Notes</span></div><div class="student-list">${students.map((student) => `<button class="student-row ${student.id === selectedStudentId ? 'selected' : ''}" data-action="select-student" data-id="${student.id}"><span class="avatar avatar-${avatarColor(student.firstName)}">${escapeHtml(initials(student.firstName))}</span><span class="student-row-name"><strong>${escapeHtml(student.firstName)}</strong><small>${student.manualNotes[0] ? escapeHtml(student.manualNotes[0].text) : 'Aucune observation'}</small></span><span class="note-count ${student.manualNotes.length ? 'has-notes' : ''}">${student.manualNotes.length}</span>${icons.chevron}</button>`).join('')}${students.length ? '' : `<div class="empty-state list-empty">${icons.search}<h3>Aucun résultat</h3><p>Essayez avec un autre prénom.</p></div>`}</div></section>${studentDetail(state.students.find((student) => student.id === selectedStudentId))}</div>
    </main>`;
  };

  const evaluationStatusLabel = (studentId: string, competencyId: string): string => {
    const savedStatus = state.competencyStatuses.find((item) =>
      item.studentId === studentId && item.competencyId === competencyId)?.status ?? CompetencyStatus.NotTaken;
    return statusOptions.find((option) => option.value === savedStatus)?.label ?? 'Non passée';
  };

  const evaluationRows = (): EvaluationRow[] => state.students
    .slice()
    .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'))
    .map((student) => {
      const row: EvaluationRow = { studentId: student.id, studentName: student.firstName };
      competenciesForSubject(evaluationSubjectId).forEach((competency) => {
        row[competency.id] = evaluationStatusLabel(student.id, competency.id);
      });
      return row;
    });

  const statusRenderer = (params: ICellRendererParams<EvaluationRow>): HTMLElement => {
    const option = statusOptions.find((item) => item.label === params.value) ?? statusOptions[3];
    const pill = document.createElement('span');
    pill.className = `evaluation-status status-${option.className}`;
    pill.textContent = option.display;
    pill.title = option.label;
    pill.setAttribute('aria-label', option.label);
    return pill;
  };

  const subjectAverage = (row?: EvaluationRow): number | null => {
    if (!row) return null;
    const competencyIds = competenciesForSubject(evaluationSubjectId).map((competency) => competency.id);
    const countedValues = competencyIds
      .map((competencyId) => row[competencyId])
      .filter((status) => status !== 'Non passée');
    if (!countedValues.length) return null;
    const validatedCount = countedValues.filter((status) => status === 'Validée').length;
    return validatedCount / countedValues.length;
  };

  const renderAverage = (value: number | null | undefined): HTMLElement => {
    const container = document.createElement('div');
    container.className = 'average-display';
    if (value === null || value === undefined) {
      container.classList.add('empty');
      container.textContent = '—';
      return container;
    }
    const percentage = Math.round(value * 100);
    container.innerHTML = `<strong>${percentage} %</strong><span><i style="width:${percentage}%"></i></span>`;
    return container;
  };

  const averageRenderer = (params: ICellRendererParams<EvaluationRow, number | null>): HTMLElement =>
    renderAverage(params.value);

  const competencyCellRenderer = (params: ICellRendererParams<EvaluationRow>): HTMLElement =>
    params.node.rowPinned
      ? renderAverage(typeof params.value === 'number' ? params.value : null)
      : statusRenderer(params);

  const averageFromStatuses = (statuses: CompetencyStatus[]): number | null => {
    const countedStatuses = statuses.filter((status) => status !== CompetencyStatus.NotTaken);
    if (!countedStatuses.length) return null;
    return countedStatuses.filter((status) => status === CompetencyStatus.Validated).length / countedStatuses.length;
  };

  const competencyAverage = (competencyId: string): number | null =>
    averageFromStatuses(state.students.map((student) =>
      state.competencyStatuses.find((item) =>
        item.studentId === student.id && item.competencyId === competencyId)?.status ?? CompetencyStatus.NotTaken));

  const evaluationSummaryRow = (): EvaluationRow => {
    const row: EvaluationRow = { studentId: 'subject-summary', studentName: 'Moyenne' };
    const competencyIds = competenciesForSubject(evaluationSubjectId).map((competency) => competency.id);
    competencyIds.forEach((competencyId) => {
      row[competencyId] = competencyAverage(competencyId);
    });
    row.subjectAverage = averageFromStatuses(competencyIds.flatMap((competencyId) =>
      state.students.map((student) =>
        state.competencyStatuses.find((item) =>
          item.studentId === student.id && item.competencyId === competencyId)?.status ?? CompetencyStatus.NotTaken)));
    return row;
  };

  const storeEvaluationStatus = (
    studentId: string,
    competencyId: string,
    status: CompetencyStatus,
  ): void => {
    const existing = state.competencyStatuses.find((item) =>
      item.studentId === studentId && item.competencyId === competencyId);
    if (existing) {
      existing.status = status;
      existing.updatedAt = new Date().toISOString();
      return;
    }
    state.competencyStatuses.push({
      studentId,
      competencyId,
      status,
      updatedAt: new Date().toISOString(),
    });
  };

  const setCompetencyStatusForAll = (
    competencyId: string,
    status: CompetencyStatus,
    api: GridApi<EvaluationRow>,
  ): void => {
    const option = statusOptions.find((item) => item.value === status);
    if (!option) return;
    state.students.forEach((student) => {
      storeEvaluationStatus(student.id, competencyId, status);
    });
    api.forEachNode((node) => {
      if (node.data) node.data[competencyId] = option.label;
    });
    void saveAppState(state).catch((error: unknown) => {
      console.error('Unable to persist bulk evaluation status', error);
    });
    api.setGridOption('pinnedBottomRowData', [evaluationSummaryRow()]);
    api.refreshCells({ columns: [competencyId, 'subjectAverage'], force: true });
  };

  class CompetencyHeaderComponent implements IHeaderComp {
    private gui!: HTMLElement;

    public init(params: IHeaderParams<EvaluationRow> & { competencyId?: string }): void {
      const competencyId = params.competencyId;
      const competency = state.competencies.find((item) => item.id === competencyId);
      const wrapper = document.createElement('div');
      wrapper.className = 'competency-grid-header';

      const code = document.createElement('span');
      code.className = 'competency-grid-header-code';
      code.textContent = competency?.nationalEducationNumber ?? 'Compétence';
      code.title = competency?.name ?? '';

      const menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = 'competency-grid-header-menu';
      menuButton.setAttribute('aria-label', `Actions pour ${code.textContent}`);
      menuButton.setAttribute('aria-haspopup', 'menu');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.title = 'Appliquer un statut à tous les élèves';
      menuButton.textContent = '⌄';

      const menuPopup = document.createElement('div');
      menuPopup.className = 'competency-grid-header-popover';
      menuPopup.setAttribute('popover', 'auto');
      menuPopup.setAttribute('role', 'menu');

      const addBulkAction = (label: string, status: CompetencyStatus): void => {
        const action = document.createElement('button');
        action.type = 'button';
        action.setAttribute('role', 'menuitem');
        action.textContent = label;
        action.addEventListener('click', (event) => {
          event.stopPropagation();
          menuPopup.hidePopover();
          window.setTimeout(() => {
            if (competencyId) setCompetencyStatusForAll(competencyId, status, params.api);
          }, 0);
        });
        menuPopup.append(action);
      };

      addBulkAction('À passer pour tous', CompetencyStatus.Absent);
      addBulkAction('Tous non passés (NE)', CompetencyStatus.NotTaken);
      menuPopup.addEventListener('pointerdown', (event) => event.stopPropagation());
      menuPopup.addEventListener('toggle', () => {
        menuButton.setAttribute('aria-expanded', String(menuPopup.matches(':popover-open')));
      });
      menuButton.addEventListener('pointerdown', (event) => event.stopPropagation());
      menuButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menuPopup.matches(':popover-open')) {
          menuPopup.hidePopover();
          return;
        }
        const bounds = menuButton.getBoundingClientRect();
        menuPopup.style.left = `${Math.min(bounds.left, window.innerWidth - 184)}px`;
        menuPopup.style.top = `${bounds.bottom + 4}px`;
        menuPopup.showPopover();
      });

      wrapper.append(code, menuButton, menuPopup);
      this.gui = wrapper;
    }

    public getGui(): HTMLElement {
      return this.gui;
    }

    public refresh(): boolean {
      return false;
    }
  }

  const handleEvaluationKey = (event: CellKeyDownEvent<EvaluationRow>): void => {
    if (event.node.rowPinned || !event.data) return;
    const keyboardEvent = event.event as KeyboardEvent;
    if (keyboardEvent.repeat) return;
    const option = statusOptions.find((item) => item.inputCode === keyboardEvent.key);
    const competencyId = event.colDef.field;
    if (!option || !competencyId || !state.competencies.some((item) => item.id === competencyId)) return;
    keyboardEvent.preventDefault();
    event.data[competencyId] = option.label;
    storeEvaluationStatus(event.data.studentId, competencyId, option.value);
    void saveAppState(state).catch((error: unknown) => {
      console.error('Unable to persist evaluation status', error);
    });
    event.api.setGridOption('pinnedBottomRowData', [evaluationSummaryRow()]);
    event.api.refreshCells({
      rowNodes: [event.node],
      columns: [competencyId, 'subjectAverage'],
      force: true,
    });
  };

  const competencyColumn = (competencyId: string, groupColorClass: string): ColDef<EvaluationRow> => {
    const competency = state.competencies.find((item) => item.id === competencyId);
    return {
      field: competencyId,
      headerName: competency?.nationalEducationNumber ?? 'Compétence',
      headerTooltip: competency
        ? competency.name
        : undefined,
      headerComponent: CompetencyHeaderComponent,
      headerComponentParams: { competencyId },
      headerClass: `evaluation-competency-header ${groupColorClass}`,
      minWidth: 50,
      width: 54,
      maxWidth: 62,
      editable: false,
      cellRenderer: competencyCellRenderer,
      cellClass: 'evaluation-cell',
      cellClassRules: {
        'evaluation-cell-absent': (params) => params.value === 'Absent',
      },
      sortable: false,
      filter: false,
      wrapHeaderText: false,
    };
  };

  const studentNameColumnWidth = (): number => {
    const labels = ['Élève', 'Moyenne', ...state.students.map((student) => student.firstName)];
    const context = document.createElement('canvas').getContext('2d');
    if (context) context.font = '600 12px Arial';
    const widestLabel = Math.max(...labels.map((label) =>
      context?.measureText(label).width ?? label.length * 7));
    return Math.max(76, Math.ceil(widestLabel + 22));
  };

  const evaluationCompetencyGroups = (): ColGroupDef<EvaluationRow>[] => {
    const grouped = new Map<string, { name: string; competencies: Competency[] }>();
    competenciesForSubject(evaluationSubjectId).forEach((competency) => {
      const group = state.groups.find((item) => item.id === competency.groupId);
      const groupKey = group?.id ?? 'ungrouped';
      const existing = grouped.get(groupKey);
      if (existing) existing.competencies.push(competency);
      else grouped.set(groupKey, { name: group?.name ?? 'Sans groupe', competencies: [competency] });
    });
    return [...grouped.values()].map((group, index) => {
      const groupColorClass = `evaluation-group-color-${index % 8}`;
      return {
        headerName: group.name,
        headerClass: `evaluation-group-header ${groupColorClass}`,
        marryChildren: true,
        children: group.competencies.map((competency) => competencyColumn(competency.id, groupColorClass)),
      };
    });
  };

  const evaluationColumns = (): (ColDef<EvaluationRow> | ColGroupDef<EvaluationRow>)[] => {
    const studentWidth = studentNameColumnWidth();
    return [{
      field: 'studentName',
      headerName: 'Élève',
      pinned: 'left',
      lockPinned: true,
      minWidth: studentWidth,
      width: studentWidth,
      maxWidth: studentWidth + 24,
      cellClass: 'student-grid-cell',
      filter: true,
      editable: false,
    },
    ...evaluationCompetencyGroups(),
    {
      colId: 'subjectAverage',
      headerName: 'Moyenne',
      headerTooltip: 'Compétences validées ÷ évaluations passées',
      pinned: 'right',
      lockPinned: true,
      minWidth: 92,
      width: 104,
      maxWidth: 120,
      editable: false,
      sortable: true,
      filter: false,
      valueGetter: (params) => params.node.rowPinned
        ? params.data?.subjectAverage ?? null
        : subjectAverage(params.data),
      cellRenderer: averageRenderer,
      cellClass: 'average-cell',
    },
    ];
  };

  const evaluationsPage = (): string => {
    const selectedSubject = state.subjects.find((subject) => subject.id === evaluationSubjectId);
    const selectedCompetencyCount = state.competencies.filter((competency) => competency.subjectId === evaluationSubjectId).length;
    return `
    <main class="workspace evaluation-workspace">
      <header class="page-header">
        <div><p class="eyebrow">Suivi des acquis</p><h1>Évaluation</h1><p class="subtitle">Sélectionnez une case, saisissez 1, 2, 9 ou 0, puis naviguez avec les flèches.</p></div>
        <div class="autosave-indicator"><span></span> Enregistrement automatique</div>
      </header>
      <div class="evaluation-tools">
        <label class="search-field">${icons.search}<input type="search" data-search="evaluations" value="${escapeHtml(evaluationSearch)}" placeholder="Rechercher un élève…"></label>
        <div class="status-legend">
          ${statusOptions.map((option) => `<span title="${escapeHtml(option.label)}"><i class="legend-dot status-${option.className}"></i>${option.inputCode ? `<kbd>${option.inputCode}</kbd> = ${option.display}` : 'À passer'}</span>`).join('')}
        </div>
      </div>
      <div class="evaluation-subject-tabs" role="tablist" aria-label="Choisir une matière">
        ${state.subjects.map((subject, index) => {
          const count = state.competencies.filter((competency) => competency.subjectId === subject.id).length;
          return `<button role="tab" aria-selected="${subject.id === evaluationSubjectId}" class="evaluation-subject-tab ${subject.id === evaluationSubjectId ? 'active' : ''}" data-action="select-evaluation-subject" data-id="${subject.id}"><i class="subject-dot color-${index % 5}"></i><span>${escapeHtml(subject.name)}</span><b>${count}</b></button>`;
        }).join('')}
      </div>
      <section class="evaluation-grid-card">
        <div class="grid-help"><strong>${escapeHtml(selectedSubject?.name ?? 'Matière')}</strong><span>${state.students.length} élèves</span><span>${selectedCompetencyCount} compétence${selectedCompetencyCount > 1 ? 's' : ''}</span><span>Flèches : déplacer · 1/2/9/0 : noter</span></div>
        <div id="evaluation-grid" class="evaluation-grid"></div>
      </section>
    </main>`;
  };

  const dictationWordCounts = (dictation: Dictation): [number, number, number] => {
    const legacyWordCount = Math.max(1, dictation.totalWords ?? 1);
    return dictation.wordCountsByLevel ?? [legacyWordCount, legacyWordCount, legacyWordCount];
  };

  const studentDictationLevel = (studentId: string, dictation: Dictation): DictationLevel =>
    dictation.studentLevels?.[studentId] ??
    state.students.find((student) => student.id === studentId)?.dictationLevel ??
    1;

  const dictationWordCountForStudent = (studentId: string, dictation: Dictation): number =>
    dictationWordCounts(dictation)[studentDictationLevel(studentId, dictation) - 1];

  const dictationRate = (studentId: string, dictation: Dictation): number | null | 'absent' => {
    const result = state.dictationResults.find((item) =>
      item.studentId === studentId && item.dictationId === dictation.id);
    if (!result) return null;
    if (result.absent) return 'absent';
    if (result.mistakeCount === undefined) return null;
    const wordCount = dictationWordCountForStudent(studentId, dictation);
    return Math.max(0, Math.min(100, ((wordCount - result.mistakeCount) / wordCount) * 100));
  };

  const dictationAverage = (dictation: Dictation): number | null => {
    const rates = state.students.map((student) => dictationRate(student.id, dictation))
      .filter((rate): rate is number => typeof rate === 'number');
    return rates.length ? rates.reduce((total, rate) => total + rate, 0) / rates.length : null;
  };

  const dictationRateClass = (rate: number): string => rate >= 90 ? 'success' : rate >= 80 ? 'warning' : 'danger';

  const dictationCell = (studentId: string, dictation: Dictation): string => {
    const rate = dictationRate(studentId, dictation);
    const level = studentDictationLevel(studentId, dictation);
    const wordCount = dictationWordCountForStudent(studentId, dictation);
    if (rate === 'absent') return `<button class="dictation-score absent" data-action="edit-dictation-result" data-student-id="${studentId}" data-id="${dictation.id}" title="Élève absent · Niveau ${level}"><span>ABS</span><small>N${level}</small></button>`;
    if (rate === null) return `<button class="dictation-score empty" data-action="edit-dictation-result" data-student-id="${studentId}" data-id="${dictation.id}" title="Saisir le nombre d’erreurs · Niveau ${level}, ${wordCount} mots"><span>—</span><small>N${level}</small></button>`;
    const result = state.dictationResults.find((item) => item.studentId === studentId && item.dictationId === dictation.id);
    const mistakes = result?.mistakeCount ?? 0;
    return `<button class="dictation-score ${dictationRateClass(rate)}" data-action="edit-dictation-result" data-student-id="${studentId}" data-id="${dictation.id}" title="${mistakes} erreur${mistakes > 1 ? 's' : ''} sur ${wordCount} mots · Niveau ${level}"><span>${rate.toFixed(2)} %</span><small>N${level}</small></button>`;
  };

  const dictationsPage = (): string => {
    const query = dictationSearch.trim().toLocaleLowerCase('fr');
    const students = state.students.slice()
      .filter((student) => student.firstName.toLocaleLowerCase('fr').includes(query))
      .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    const dictations = state.dictations.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return `<main class="workspace evaluation-workspace dictation-workspace">
      <header class="page-header"><div><p class="eyebrow">Évaluation / Dictée</p><h1>Dictée</h1><p class="subtitle">Chaque niveau possède son propre nombre de mots et reste mémorisé pour chaque élève.</p></div><div class="page-header-actions"><button class="secondary-button" data-action="manage-dictation-levels">Niveaux des élèves</button><button class="primary-button" data-action="new-dictation">${icons.plus} Nouvelle dictée</button></div></header>
      <div class="evaluation-tools"><label class="search-field">${icons.search}<input type="search" data-search="dictations" value="${escapeHtml(dictationSearch)}" placeholder="Rechercher un élève…"></label><div class="dictation-legend"><span><i class="legend-dot dictation-success"></i> 90 à 100 %</span><span><i class="legend-dot dictation-warning"></i> 80 à 89,99 %</span><span><i class="legend-dot dictation-danger"></i> moins de 80 %</span></div></div>
      <section class="evaluation-grid-card dictation-card">
        <div class="grid-help"><strong>Résultats des dictées</strong><span>${state.students.length} élèves</span><span>${dictations.length} dictée${dictations.length > 1 ? 's' : ''}</span><span>Cliquez sur une case pour saisir les erreurs</span></div>
        ${dictations.length ? `<div class="dictation-table-scroll"><table class="dictation-table"><thead><tr><th class="dictation-student-column">Élève</th>${dictations.map((dictation) => { const wordCounts = dictationWordCounts(dictation); return `<th><div class="dictation-header"><strong>${escapeHtml(dictation.name)}</strong><small>N1 ${wordCounts[0]} · N2 ${wordCounts[1]} · N3 ${wordCounts[2]}</small><span><button class="icon-button subtle" data-action="edit-dictation" data-id="${dictation.id}" title="Modifier">${icons.edit}</button><button class="icon-button subtle danger" data-action="delete-dictation" data-id="${dictation.id}" title="Supprimer">${icons.trash}</button></span></div></th>`; }).join('')}</tr></thead><tbody>${students.map((student) => `<tr><th class="dictation-student-column">${escapeHtml(student.firstName)}<small class="student-default-level">N${student.dictationLevel ?? 1}</small></th>${dictations.map((dictation) => `<td>${dictationCell(student.id, dictation)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th class="dictation-student-column">Moyenne</th>${dictations.map((dictation) => { const average = dictationAverage(dictation); return `<td><span class="dictation-average ${average === null ? 'empty' : dictationRateClass(average)}">${average === null ? '—' : `${average.toFixed(2)} %`}</span></td>`; }).join('')}</tr></tfoot></table></div>` : `<div class="empty-state dictation-empty">${icons.grid}<h3>Votre première dictée</h3><p>Définissez les niveaux des élèves, puis ajoutez les trois nombres de mots.</p><button class="primary-button" data-action="new-dictation">${icons.plus} Nouvelle dictée</button></div>`}
      </section>
    </main>`;
  };

  const mountEvaluationGrid = (): void => {
    const gridElement = root.querySelector<HTMLElement>('#evaluation-grid');
    if (!gridElement) return;
    const gridOptions: GridOptions<EvaluationRow> = {
      theme: evaluationTheme,
      rowData: evaluationRows(),
      pinnedBottomRowData: [evaluationSummaryRow()],
      columnDefs: evaluationColumns(),
      defaultColDef: { resizable: true, suppressMovable: true },
      getRowId: (params) => params.data.studentId,
      getRowHeight: (params) => params.node.rowPinned ? 43 : 37,
      groupHeaderHeight: 31,
      headerHeight: 104,
      quickFilterText: evaluationSearch,
      onCellKeyDown: handleEvaluationKey,
      ensureDomOrder: true,
      tooltipShowDelay: 250,
    };
    evaluationGridApi = createGrid<EvaluationRow>(gridElement, gridOptions);
  };

  const render = (): void => {
    evaluationGridApi?.destroy();
    evaluationGridApi = undefined;
    const pageContent = page === 'competencies'
      ? competenciesPage()
      : page === 'students'
        ? studentsPage()
        : page === 'evaluations'
          ? evaluationsPage()
          : dictationsPage();
    root.innerHTML = `<div class="app-shell">${sidebar()}${pageContent}</div>`;
    if (page === 'evaluations') window.requestAnimationFrame(mountEvaluationGrid);
  };

  const persist = (): void => {
    void saveAppState(state).catch((error: unknown) => {
      console.error('Unable to persist application state', error);
    });
    render();
  };

  interface ModalOptions { eyebrow: string; title: string; fields: string; submit: string; destructive?: boolean; save: (data: FormData) => void }
  let modalReturnFocus: HTMLElement | null = null;
  const closeModal = (): void => {
    document.querySelector<HTMLElement>('#app-modal')?.remove();
    root.removeAttribute('inert');
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
  };
  const error = (message: string): void => { const element = document.querySelector('#form-error'); if (element) element.textContent = message; };
  const field = (label: string, name: string, value = '', placeholder = ''): string => `<label class="form-field"><span>${label}</span><input type="text" name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" required></label>`;

  const modal = (options: ModalOptions): void => {
    closeModal();
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.setAttribute('inert', '');
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="app-modal"><form class="modal-card" id="modal-form" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><p class="eyebrow">${escapeHtml(options.eyebrow)}</p><h2 id="modal-title">${escapeHtml(options.title)}</h2></div><button type="button" class="icon-button" data-modal-close aria-label="Fermer">${icons.close}</button></div><div class="modal-content">${options.fields}<p class="form-error" id="form-error"></p></div><div class="modal-actions"><button type="button" class="secondary-button" data-modal-close>Annuler</button><button class="primary-button${options.destructive ? ' destructive-button' : ''}" type="submit">${options.submit}</button></div></form></div>`);
    const layer = document.querySelector<HTMLElement>('#app-modal');
    const form = layer?.querySelector<HTMLFormElement>('#modal-form');
    layer?.addEventListener('pointerdown', (event) => { if (event.target === layer) closeModal(); });
    layer?.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeModal(); } });
    layer?.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
    form?.addEventListener('submit', (event) => { event.preventDefault(); options.save(new FormData(form)); });
    const firstControl = form?.querySelector<HTMLElement>('input,textarea,select,button[type="submit"]');
    const focusFirstControl = (): void => {
      if (layer?.isConnected && firstControl?.isConnected) firstControl.focus({ preventScroll: true });
    };
    focusFirstControl();
    window.requestAnimationFrame(focusFirstControl);
    layer?.addEventListener('focusout', () => {
      window.requestAnimationFrame(() => {
        if (layer?.isConnected && !layer.contains(document.activeElement)) focusFirstControl();
      });
    });
  };

  const confirmDeletion = (title: string, message: string, remove: () => void): void => {
    modal({
      eyebrow: 'Confirmation',
      title,
      fields: `<p class="confirmation-message">${escapeHtml(message)}</p>`,
      submit: 'Supprimer',
      destructive: true,
      save: () => { closeModal(); remove(); },
    });
  };

  const subjectModal = (id?: string): void => {
    const subject = state.subjects.find((item) => item.id === id);
    modal({ eyebrow: 'Référentiel', title: subject ? 'Renommer la matière' : 'Nouvelle matière', fields: field('Nom de la matière', 'name', subject?.name, 'Ex. Histoire & Géographie'), submit: subject ? 'Enregistrer' : 'Créer la matière', save: (data) => {
      const name = String(data.get('name') ?? '').trim(); if (!name) return error('Indiquez un nom de matière.');
      if (subject) subject.name = name; else { const created = { id: uid('subject'), name }; state.subjects.push(created); selectedSubjectId = created.id; }
      closeModal(); persist();
    } });
  };

  const groupModal = (id?: string, parentGroupId?: string): void => {
    const group = state.groups.find((item) => item.id === id);
    const parent = state.groups.find((item) => item.id === parentGroupId);
    modal({ eyebrow: parent ? `Dans ${parent.name}` : 'Organisation', title: group ? 'Modifier le groupe' : parent ? 'Nouveau sous-groupe' : 'Nouveau groupe', fields: field('Nom du groupe', 'name', group?.name, 'Ex. Géométrie et mesures'), submit: group ? 'Enregistrer' : 'Créer le groupe', save: (data) => {
      const name = String(data.get('name') ?? '').trim(); if (!name) return error('Indiquez un nom de groupe.');
      if (group) group.name = name; else state.groups.push({ id: uid('group'), subjectId: selectedSubjectId, parentGroupId, name });
      closeModal(); persist();
    } });
  };

  const groupOptions = (selected?: string): string => {
    const options = ['<option value="">Sans groupe</option>'];
    const add = (parentId?: string, depth = 0): void => state.groups.filter((group) => group.subjectId === selectedSubjectId && group.parentGroupId === parentId).forEach((group) => { options.push(`<option value="${group.id}" ${selected === group.id ? 'selected' : ''}>${'— '.repeat(depth)}${escapeHtml(group.name)}</option>`); add(group.id, depth + 1); });
    add(); return options.join('');
  };

  const competencyModal = (id?: string, preferredGroup?: string): void => {
    const item = state.competencies.find((competency) => competency.id === id); if (!selectedSubjectId) return;
    modal({ eyebrow: 'Référentiel pédagogique', title: item ? 'Modifier la compétence' : 'Nouvelle compétence', fields: `${field('Intitulé', 'name', item?.name, 'Ex. Poser et effectuer une addition')}${field('Numéro Éducation nationale', 'code', item?.nationalEducationNumber, 'Ex. C2-MATH-08')}<label class="form-field"><span>Groupe</span><select name="groupId">${groupOptions(item?.groupId ?? preferredGroup)}</select></label>`, submit: item ? 'Enregistrer' : 'Ajouter la compétence', save: (data) => {
      const name = String(data.get('name') ?? '').trim(); const code = String(data.get('code') ?? '').trim(); const groupId = String(data.get('groupId') ?? '') || undefined;
      if (!name || !code) return error('Complétez l’intitulé et le numéro officiel.');
      if (item) {
        const previousGroupId = item.groupId;
        Object.assign(item, { name, nationalEducationNumber: code });
        if (previousGroupId !== groupId) {
          item.groupId = groupId;
          normalizeGroupOrder(previousGroupId);
          item.sortOrder = competenciesInGroup(groupId).filter((competency) => competency.id !== item.id).length;
        }
      } else {
        state.competencies.push({ id: uid('competency'), subjectId: selectedSubjectId, groupId, name, nationalEducationNumber: code, sortOrder: competenciesInGroup(groupId).length });
      }
      closeModal(); persist();
    } });
  };

  const studentModal = (id?: string): void => {
    const student = state.students.find((item) => item.id === id);
    modal({ eyebrow: 'Classe', title: student ? 'Modifier l’élève' : 'Nouvel élève', fields: field('Prénom', 'firstName', student?.firstName, 'Ex. Camille'), submit: student ? 'Enregistrer' : 'Ajouter à la classe', save: (data) => {
      const firstName = String(data.get('firstName') ?? '').trim(); if (!firstName) return error('Indiquez le prénom de l’élève.');
      if (student) student.firstName = firstName; else { const created: Student = { id: uid('student'), firstName, manualNotes: [], dictationLevel: 1 }; state.students.push(created); selectedStudentId = created.id; }
      closeModal(); persist();
    } });
  };

  const noteModal = (studentId: string): void => {
    const student = state.students.find((item) => item.id === studentId); if (!student) return;
    modal({ eyebrow: student.firstName, title: 'Ajouter une note de suivi', fields: '<label class="form-field"><span>Observation</span><textarea name="text" rows="5" placeholder="Écrivez votre observation…" required></textarea><small>Cette note reste enregistrée localement.</small></label>', submit: 'Enregistrer la note', save: (data) => {
      const text = String(data.get('text') ?? '').trim(); if (!text) return error('Écrivez une observation.'); student.manualNotes.push({ id: uid('note'), text, createdAt: new Date().toISOString() }); closeModal(); persist();
    } });
  };

  const dictationModal = (id?: string): void => {
    const dictation = state.dictations.find((item) => item.id === id);
    const wordCounts = dictation ? dictationWordCounts(dictation) : [20, 30, 40];
    modal({
      eyebrow: 'Évaluation / Dictée',
      title: dictation ? 'Modifier la dictée' : 'Nouvelle dictée',
      fields: `${field('Nom de la dictée', 'name', dictation?.name, 'Ex. Dictée 1')}<div class="dictation-word-count-fields">${([1, 2, 3] as DictationLevel[]).map((level) => `<label class="form-field"><span>Niveau ${level}</span><input type="number" name="level${level}Words" value="${wordCounts[level - 1]}" min="1" step="1" required><small>Nombre de mots</small></label>`).join('')}</div><p class="form-hint">Chaque élève sera calculé avec le total correspondant à son niveau.</p>`,
      submit: dictation ? 'Enregistrer' : 'Créer la dictée',
      save: (data) => {
        const name = String(data.get('name') ?? '').trim();
        const nextWordCounts = ([1, 2, 3] as DictationLevel[]).map((level) =>
          Number(data.get(`level${level}Words`))) as [number, number, number];
        if (!name) return error('Indiquez un nom pour la dictée.');
        if (nextWordCounts.some((wordCount) => !Number.isInteger(wordCount) || wordCount < 1)) return error('Indiquez trois nombres entiers de mots supérieurs à zéro.');
        if (!(nextWordCounts[0] < nextWordCounts[1] && nextWordCounts[1] < nextWordCounts[2])) return error('Chaque niveau doit avoir plus de mots que le niveau précédent.');
        if (dictation) {
          const invalidResult = state.dictationResults.find((result) => {
            if (result.dictationId !== dictation.id || result.mistakeCount === undefined) return false;
            const resultLevel = studentDictationLevel(result.studentId, dictation);
            return result.mistakeCount > nextWordCounts[resultLevel - 1];
          });
          if (invalidResult) return error('Un résultat contient plus d’erreurs que le nouveau nombre de mots de son niveau.');
        }
        if (dictation) Object.assign(dictation, { name, wordCountsByLevel: nextWordCounts });
        else state.dictations.push({
          id: uid('dictation'),
          name,
          wordCountsByLevel: nextWordCounts,
          studentLevels: Object.fromEntries(state.students.map((student) => [student.id, student.dictationLevel ?? 1])),
          createdAt: new Date().toISOString(),
        });
        closeModal();
        persist();
      },
    });
  };

  const dictationLevelsModal = (): void => {
    const students = state.students.slice().sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    modal({
      eyebrow: 'Niveaux de dictée',
      title: 'Niveaux des élèves',
      fields: `<p class="form-hint">Ces niveaux sont enregistrés pour les prochaines dictées et appliqués immédiatement aux dictées sans résultat. Les dictées déjà notées conservent leur niveau historique.</p><div class="dictation-level-list">${students.map((student) => `<label><span>${escapeHtml(student.firstName)}</span><select name="level-${student.id}">${([1, 2, 3] as DictationLevel[]).map((level) => `<option value="${level}" ${level === (student.dictationLevel ?? 1) ? 'selected' : ''}>Niveau ${level}</option>`).join('')}</select></label>`).join('')}</div>`,
      submit: 'Enregistrer les niveaux',
      save: (data) => {
        students.forEach((student) => {
          const level = Number(data.get(`level-${student.id}`));
          if (level !== 1 && level !== 2 && level !== 3) return;
          student.dictationLevel = level;
          state.dictations.forEach((dictation) => {
            const hasResult = state.dictationResults.some((result) =>
              result.studentId === student.id && result.dictationId === dictation.id);
            if (hasResult) return;
            dictation.studentLevels ??= {};
            dictation.studentLevels[student.id] = level;
          });
        });
        closeModal();
        persist();
      },
    });
  };

  const dictationResultModal = (studentId: string, dictationId: string): void => {
    const student = state.students.find((item) => item.id === studentId);
    const dictation = state.dictations.find((item) => item.id === dictationId);
    if (!student || !dictation) return;
    const existing = state.dictationResults.find((item) =>
      item.studentId === studentId && item.dictationId === dictationId);
    const level = studentDictationLevel(studentId, dictation);
    const wordCounts = dictationWordCounts(dictation);
    modal({
      eyebrow: `${student.firstName} · ${dictation.name}`,
      title: 'Résultat de la dictée',
      fields: `<label class="form-field"><span>Niveau de l’élève</span><select name="level">${([1, 2, 3] as DictationLevel[]).map((candidate) => `<option value="${candidate}" ${candidate === level ? 'selected' : ''}>Niveau ${candidate} · ${wordCounts[candidate - 1]} mots</option>`).join('')}</select><small>Ce choix sera repris par défaut pour les prochaines dictées.</small></label><label class="form-field"><span>Nombre d’erreurs</span><input type="number" name="mistakeCount" value="${existing?.mistakeCount ?? ''}" min="0" max="${Math.max(...wordCounts)}" step="1" placeholder="Laisser vide pour effacer"><small>Une saisie vide conserve le niveau mais efface le résultat.</small></label><label class="checkbox-field"><input type="checkbox" name="absent" ${existing?.absent ? 'checked' : ''}><span>Élève absent pour cette dictée</span></label>`,
      submit: 'Enregistrer',
      save: (data) => {
        const absent = data.get('absent') === 'on';
        const nextLevel = Number(data.get('level')) as DictationLevel;
        if (nextLevel !== 1 && nextLevel !== 2 && nextLevel !== 3) return error('Choisissez un niveau valide.');
        const wordCount = wordCounts[nextLevel - 1];
        const rawMistakeCount = String(data.get('mistakeCount') ?? '').trim();
        const mistakeCount = absent ? undefined : Number(rawMistakeCount);
        if (!absent && rawMistakeCount !== '' && (!Number.isInteger(mistakeCount) || mistakeCount < 0 || mistakeCount > wordCount)) {
          return error(`Indiquez un nombre entier entre 0 et ${wordCount} pour le niveau ${nextLevel}.`);
        }
        dictation.studentLevels ??= {};
        dictation.studentLevels[studentId] = nextLevel;
        student.dictationLevel = nextLevel;
        if (!absent && rawMistakeCount === '') {
          state.dictationResults = state.dictationResults.filter((item) =>
            item.studentId !== studentId || item.dictationId !== dictationId);
          closeModal();
          persist();
          return;
        }
        const result = existing ?? { studentId, dictationId, updatedAt: new Date().toISOString() };
        Object.assign(result, { mistakeCount, absent, updatedAt: new Date().toISOString() });
        if (!existing) state.dictationResults.push(result);
        closeModal();
        persist();
      },
    });
  };

  const descendants = (id: string): string[] => [id, ...state.groups.filter((group) => group.parentGroupId === id).flatMap((group) => descendants(group.id))];

  const clearDropIndicators = (): void => {
    root.querySelectorAll('.drop-before,.drop-after,.drop-active,.dragging').forEach((element) => {
      element.classList.remove('drop-before', 'drop-after', 'drop-active', 'dragging');
    });
  };

  const moveCompetency = (competencyId: string, groupId: string | undefined, targetId?: string, afterTarget = false): boolean => {
    const competency = state.competencies.find((item) => item.id === competencyId);
    if (!competency || competency.subjectId !== selectedSubjectId || targetId === competencyId) return false;
    const previousGroupId = competency.groupId;
    const targetItems = competenciesInGroup(groupId).filter((item) => item.id !== competencyId);
    let targetIndex = targetId ? targetItems.findIndex((item) => item.id === targetId) : targetItems.length;
    if (targetIndex < 0) targetIndex = targetItems.length;
    if (targetId && afterTarget) targetIndex += 1;
    competency.groupId = groupId;
    targetItems.splice(targetIndex, 0, competency);
    targetItems.forEach((item, index) => { item.sortOrder = index; });
    if (previousGroupId !== groupId) normalizeGroupOrder(previousGroupId);
    return true;
  };

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!button) return;
    const action = button.dataset.action; const id = button.dataset.id;
    if (action === 'navigate') { page = button.dataset.page as Page; render(); }
    else if (action === 'select-subject' && id) { selectedSubjectId = id; render(); }
    else if (action === 'select-evaluation-subject' && id) { evaluationSubjectId = id; render(); }
    else if (action === 'new-dictation') dictationModal();
    else if (action === 'manage-dictation-levels') dictationLevelsModal();
    else if (action === 'edit-dictation' && id) dictationModal(id);
    else if (action === 'edit-dictation-result' && id && button.dataset.studentId) dictationResultModal(button.dataset.studentId, id);
    else if (action === 'delete-dictation' && id) confirmDeletion('Supprimer cette dictée ?', 'Tous les résultats associés seront également supprimés.', () => { state.dictations = state.dictations.filter((item) => item.id !== id); state.dictationResults = state.dictationResults.filter((item) => item.dictationId !== id); persist(); });
    else if (action === 'new-subject') subjectModal();
    else if (action === 'edit-subject' && id) subjectModal(id);
    else if (action === 'new-group') groupModal();
    else if (action === 'new-subgroup' && id) groupModal(undefined, id);
    else if (action === 'edit-group' && id) groupModal(id);
    else if (action === 'toggle-group' && id) { collapsedGroups.has(id) ? collapsedGroups.delete(id) : collapsedGroups.add(id); render(); }
    else if (action === 'new-competency') competencyModal(undefined, button.dataset.groupId);
    else if (action === 'edit-competency' && id) competencyModal(id);
    else if (action === 'delete-competency' && id) confirmDeletion('Supprimer cette compétence ?', 'Les évaluations associées à cette compétence seront également supprimées.', () => { state.competencies = state.competencies.filter((item) => item.id !== id); state.competencyStatuses = state.competencyStatuses.filter((item) => item.competencyId !== id); persist(); });
    else if (action === 'delete-group' && id) confirmDeletion('Supprimer ce groupe ?', 'Ses sous-groupes seront supprimés. Les compétences seront conservées sans groupe.', () => { const ids = descendants(id); state.groups = state.groups.filter((group) => !ids.includes(group.id)); state.competencies.forEach((item) => { if (item.groupId && ids.includes(item.groupId)) item.groupId = undefined; }); normalizeGroupOrder(); persist(); });
    else if (action === 'new-student') studentModal();
    else if (action === 'edit-student' && id) studentModal(id);
    else if (action === 'select-student' && id) { selectedStudentId = id; render(); }
    else if (action === 'new-note' && id) noteModal(id);
    else if (action === 'delete-note' && id && button.dataset.studentId) { const studentId = button.dataset.studentId; confirmDeletion('Supprimer cette note ?', 'Cette note de suivi ne sera plus visible.', () => { const student = state.students.find((item) => item.id === studentId); if (student) student.manualNotes = student.manualNotes.filter((note) => note.id !== id); persist(); }); }
    else if (action === 'delete-student' && id) confirmDeletion('Supprimer cet élève ?', 'Ses notes et ses résultats seront également supprimés.', () => { state.students = state.students.filter((student) => student.id !== id); state.competencyStatuses = state.competencyStatuses.filter((item) => item.studentId !== id); state.dictationResults = state.dictationResults.filter((item) => item.studentId !== id); selectedStudentId = state.students[0]?.id ?? ''; persist(); });
  });

  root.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-search]'); if (!input) return;
    if (input.dataset.search === 'evaluations') {
      evaluationSearch = input.value;
      evaluationGridApi?.setGridOption('quickFilterText', evaluationSearch);
      return;
    }
    if (input.dataset.search === 'dictations') {
      dictationSearch = input.value;
      const position = input.selectionStart ?? input.value.length;
      render();
      const next = root.querySelector<HTMLInputElement>('[data-search="dictations"]');
      next?.focus();
      next?.setSelectionRange(position, position);
      return;
    }
    if (input.dataset.search === 'competencies') competencySearch = input.value; else studentSearch = input.value;
    const position = input.selectionStart ?? input.value.length; render(); const next = root.querySelector<HTMLInputElement>(`[data-search="${input.dataset.search}"]`); next?.focus(); next?.setSelectionRange(position, position);
  });

  root.addEventListener('dragstart', (event) => {
    const dragEvent = event as DragEvent;
    const handle = (event.target as HTMLElement).closest<HTMLElement>('.drag-handle[data-competency-id]');
    if (!handle || competencySearch.trim()) return dragEvent.preventDefault();
    draggedCompetencyId = handle.dataset.competencyId;
    if (!draggedCompetencyId) return dragEvent.preventDefault();
    dragEvent.dataTransfer?.setData('text/plain', draggedCompetencyId);
    if (dragEvent.dataTransfer) dragEvent.dataTransfer.effectAllowed = 'move';
    window.requestAnimationFrame(() => handle.closest('.competency-row')?.classList.add('dragging'));
  });

  root.addEventListener('dragover', (event) => {
    if (!draggedCompetencyId) return;
    const dragEvent = event as DragEvent;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('.competency-row[data-competency-id]');
    const dropZone = (row ?? target).closest<HTMLElement>('[data-drop-group-id]');
    if (!dropZone) return;
    dragEvent.preventDefault();
    if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = 'move';
    root.querySelectorAll('.drop-before,.drop-after,.drop-active').forEach((element) => element.classList.remove('drop-before', 'drop-after', 'drop-active'));
    dropZone.classList.add('drop-active');
    if (row && row.dataset.competencyId !== draggedCompetencyId) {
      row.classList.add(dragEvent.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2 ? 'drop-after' : 'drop-before');
    }
  });

  root.addEventListener('drop', (event) => {
    if (!draggedCompetencyId) return;
    const dragEvent = event as DragEvent;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('.competency-row[data-competency-id]');
    const dropZone = (row ?? target).closest<HTMLElement>('[data-drop-group-id]');
    if (!dropZone) return;
    dragEvent.preventDefault();
    const afterTarget = Boolean(row && dragEvent.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2);
    const moved = moveCompetency(draggedCompetencyId, dropZone.dataset.dropGroupId || undefined, row?.dataset.competencyId, afterTarget);
    draggedCompetencyId = undefined;
    clearDropIndicators();
    if (moved) persist();
  });

  root.addEventListener('dragend', () => {
    draggedCompetencyId = undefined;
    clearDropIndicators();
  });

  render();
};
