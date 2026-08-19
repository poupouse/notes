import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
  type CellValueChangedEvent,
  type ColDef,
  type ColGroupDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
} from 'ag-grid-community';

import { loadAppState, saveAppState, type AppState } from './app-state';
import { CompetencyStatus } from './domain';
import type { CompetencyGroup, Student } from './domain';

ModuleRegistry.registerModules([AllCommunityModule]);

type Page = 'competencies' | 'students' | 'evaluations';

interface EvaluationRow {
  studentId: string;
  studentName: string;
  [competencyId: string]: string;
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

const statusOptions = [
  { value: CompetencyStatus.Validated, label: 'Validée', className: 'validated' },
  { value: CompetencyStatus.Failed, label: 'Ratée', className: 'failed' },
  { value: CompetencyStatus.InProgress, label: 'En cours', className: 'in-progress' },
  { value: CompetencyStatus.NotTaken, label: 'Non passée', className: 'not-taken' },
  { value: CompetencyStatus.Absent, label: 'Absent', className: 'absent' },
] as const;

const evaluationTheme = themeQuartz.withParams({
  accentColor: '#41695a',
  backgroundColor: '#ffffff',
  borderColor: '#e3e3dd',
  borderRadius: 8,
  fontFamily: 'Inter, ui-sans-serif, Segoe UI, sans-serif',
  fontSize: 12,
  foregroundColor: '#353a35',
  headerBackgroundColor: '#f5f6f3',
  headerTextColor: '#58605a',
  rowHoverColor: '#f3f6f4',
  selectedRowBackgroundColor: '#e8f0ec',
  spacing: 5,
});

export const startApp = (): void => {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Application root not found');

  const state: AppState = loadAppState();
  let page: Page = 'competencies';
  let selectedSubjectId = state.subjects[0]?.id ?? '';
  let selectedStudentId = state.students[0]?.id ?? '';
  let competencySearch = '';
  let studentSearch = '';
  let evaluationSearch = '';
  let evaluationGridApi: GridApi<EvaluationRow> | undefined;
  const collapsedGroups = new Set<string>();
  const uid = (prefix: string): string => {
    const randomValues = crypto.getRandomValues(new Uint32Array(2));
    return `${prefix}-${Date.now().toString(36)}-${randomValues[0].toString(36)}${randomValues[1].toString(36)}`;
  };

  const subjectCount = (subjectId: string): number =>
    state.competencies.filter((item) => item.subjectId === subjectId).length;

  const sidebar = (): string => `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${icons.spark}</div><div><strong>Carnet</strong><span>Suivi de classe</span></div></div>
      <nav class="main-nav"><p class="nav-label">Espace de travail</p>
        <button class="nav-item ${page === 'competencies' ? 'active' : ''}" data-action="navigate" data-page="competencies">${icons.layers}<span>Compétences</span><b>${state.competencies.length}</b></button>
        <button class="nav-item ${page === 'students' ? 'active' : ''}" data-action="navigate" data-page="students">${icons.users}<span>Élèves</span><b>${state.students.length}</b></button>
        <button class="nav-item ${page === 'evaluations' ? 'active' : ''}" data-action="navigate" data-page="evaluations">${icons.grid}<span>Évaluation</span><b>${state.competencyStatuses.length}</b></button>
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
    return `<div class="competency-row"><span class="drag-handle">⠿</span><div class="competency-main"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.nationalEducationNumber)}</small></div><div class="row-actions"><button class="icon-button subtle" data-action="edit-competency" data-id="${id}" title="Modifier">${icons.edit}</button><button class="icon-button subtle danger" data-action="delete-competency" data-id="${id}" title="Supprimer">${icons.trash}</button></div></div>`;
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
    const items = state.competencies.filter((item) => item.groupId === group.id && (!query || `${item.name} ${item.nationalEducationNumber}`.toLocaleLowerCase('fr').includes(query)));
    const children = state.groups.filter((child) => child.parentGroupId === group.id);
    const collapsed = collapsedGroups.has(group.id) && !query;
    const count = state.competencies.filter((item) => item.groupId === group.id).length;
    return `<section class="group-card depth-${Math.min(depth, 2)}">
      <div class="group-header"><button class="collapse-button ${collapsed ? '' : 'open'}" data-action="toggle-group" data-id="${group.id}">${icons.chevron}</button><div class="group-title"><strong>${escapeHtml(group.name)}</strong><span>${count} compétence${count > 1 ? 's' : ''}</span></div><div class="group-actions"><button class="quiet-button" data-action="new-subgroup" data-id="${group.id}">${icons.plus} Sous-groupe</button><button class="icon-button subtle" data-action="edit-group" data-id="${group.id}">${icons.edit}</button><button class="icon-button subtle danger" data-action="delete-group" data-id="${group.id}">${icons.trash}</button></div></div>
      ${collapsed ? '' : `<div class="group-content">${items.map((item) => competencyRow(item.id)).join('')}${children.map((child) => groupCard(child, depth + 1)).join('')}<button class="add-competency-inline" data-action="new-competency" data-group-id="${group.id}">${icons.plus} Ajouter une compétence</button></div>`}
    </section>`;
  };

  const competenciesPage = (): string => {
    const subject = state.subjects.find((item) => item.id === selectedSubjectId);
    const groups = state.groups.filter((group) => group.subjectId === selectedSubjectId && !group.parentGroupId);
    const ungrouped = state.competencies.filter((item) => item.subjectId === selectedSubjectId && !item.groupId);
    return `<main class="workspace">
      <header class="page-header"><div><p class="eyebrow">Référentiel pédagogique</p><h1>Compétences</h1><p class="subtitle">Organisez votre référentiel par matière et par domaine.</p></div><button class="primary-button" data-action="new-competency" ${subject ? '' : 'disabled'}>${icons.plus} Nouvelle compétence</button></header>
      <div class="page-tools"><label class="search-field">${icons.search}<input type="search" data-search="competencies" value="${escapeHtml(competencySearch)}" placeholder="Rechercher une compétence ou un numéro…"></label><div class="summary-chip">${icons.book} ${subjectCount(selectedSubjectId)} compétences</div></div>
      <div class="competency-layout">${subjectRail()}<div class="tree-panel">
        ${subject ? `<div class="tree-heading"><div><span class="breadcrumb">Matières / ${escapeHtml(subject.name)}</span><h2>${escapeHtml(subject.name)}</h2></div><button class="secondary-button" data-action="new-group">${icons.plus} Nouveau groupe</button></div><div class="tree-list">${groups.map((group) => groupCard(group)).join('')}${ungrouped.length ? `<section class="group-card ungrouped"><div class="group-header"><div class="group-title"><strong>Sans groupe</strong><span>${ungrouped.length} compétence${ungrouped.length > 1 ? 's' : ''}</span></div></div><div class="group-content">${ungrouped.map((item) => competencyRow(item.id)).join('')}</div></section>` : ''}${!groups.length && !ungrouped.length ? emptyState('Une page encore blanche', 'Créez un groupe ou ajoutez votre première compétence.', 'new-group', 'Créer un groupe') : ''}</div>` : emptyState('Ajoutez une matière', 'Les compétences seront organisées dans vos matières.', 'new-subject', 'Nouvelle matière')}
      </div></div>
    </main>`;
  };

  const emptyState = (title: string, text: string, action: string, label: string): string =>
    `<div class="empty-state">${icons.layers}<h3>${title}</h3><p>${text}</p><button class="primary-button" data-action="${action}">${icons.plus} ${label}</button></div>`;

  const initials = (name: string): string => name.trim().slice(0, 2).toLocaleUpperCase('fr');
  const avatarColor = (name: string): number => [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
  const formatDate = (value: string): string => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

  const studentDetail = (student?: Student): string => {
    if (!student) return `<aside class="student-detail empty-detail">${icons.users}<p>Sélectionnez un élève</p></aside>`;
    const notes = [...student.manualNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `<aside class="student-detail">
      <div class="detail-topbar"><span>Fiche élève</span><div><button class="icon-button" data-action="edit-student" data-id="${student.id}">${icons.edit}</button><button class="icon-button danger" data-action="delete-student" data-id="${student.id}">${icons.trash}</button></div></div>
      <div class="student-identity"><div class="avatar large avatar-${avatarColor(student.firstName)}">${escapeHtml(initials(student.firstName))}</div><div><h2>${escapeHtml(student.firstName)}</h2><p>${notes.length} note${notes.length > 1 ? 's' : ''} personnelle${notes.length > 1 ? 's' : ''}</p></div></div>
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
      state.competencies.forEach((competency) => {
        row[competency.id] = evaluationStatusLabel(student.id, competency.id);
      });
      return row;
    });

  const statusRenderer = (params: ICellRendererParams<EvaluationRow, string>): HTMLElement => {
    const option = statusOptions.find((item) => item.label === params.value) ?? statusOptions[3];
    const pill = document.createElement('span');
    pill.className = `evaluation-status status-${option.className}`;
    pill.textContent = option.label;
    return pill;
  };

  const saveEvaluationStatus = (event: CellValueChangedEvent<EvaluationRow, string>): void => {
    const competencyId = event.colDef.field;
    const studentId = event.data?.studentId;
    const option = statusOptions.find((item) => item.label === event.newValue);
    if (!competencyId || !studentId || !option) return;

    const existing = state.competencyStatuses.find((item) =>
      item.studentId === studentId && item.competencyId === competencyId);
    if (existing) {
      existing.status = option.value;
      existing.updatedAt = new Date().toISOString();
    } else {
      state.competencyStatuses.push({
        studentId,
        competencyId,
        status: option.value,
        updatedAt: new Date().toISOString(),
      });
    }
    saveAppState(state);
  };

  const competencyColumn = (competencyId: string): ColDef<EvaluationRow> => {
    const competency = state.competencies.find((item) => item.id === competencyId);
    return {
      field: competencyId,
      headerName: competency?.name ?? 'Compétence',
      headerTooltip: competency
        ? `${competency.nationalEducationNumber} — ${competency.name}`
        : undefined,
      minWidth: 175,
      width: 195,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: statusOptions.map((option) => option.label) },
      cellRenderer: statusRenderer,
      cellClass: 'evaluation-cell',
      sortable: false,
      filter: false,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    };
  };

  const evaluationColumns = (): (ColDef<EvaluationRow> | ColGroupDef<EvaluationRow>)[] => [
    {
      field: 'studentName',
      headerName: 'Élève',
      pinned: 'left',
      lockPinned: true,
      minWidth: 180,
      width: 205,
      cellClass: 'student-grid-cell',
      filter: true,
      editable: false,
    },
    ...state.subjects
      .map((subject): ColGroupDef<EvaluationRow> | undefined => {
        const competencies = state.competencies.filter((item) => item.subjectId === subject.id);
        if (!competencies.length) return undefined;
        return {
          headerName: subject.name,
          marryChildren: true,
          children: competencies.map((competency) => competencyColumn(competency.id)),
        };
      })
      .filter((column): column is ColGroupDef<EvaluationRow> => Boolean(column)),
  ];

  const evaluationsPage = (): string => `
    <main class="workspace evaluation-workspace">
      <header class="page-header">
        <div><p class="eyebrow">Suivi des acquis</p><h1>Évaluation</h1><p class="subtitle">Attribuez un statut à chaque compétence, élève par élève.</p></div>
        <div class="autosave-indicator"><span></span> Enregistrement automatique</div>
      </header>
      <div class="evaluation-tools">
        <label class="search-field">${icons.search}<input type="search" data-search="evaluations" value="${escapeHtml(evaluationSearch)}" placeholder="Rechercher un élève…"></label>
        <div class="status-legend">
          ${statusOptions.map((option) => `<span><i class="legend-dot status-${option.className}"></i>${option.label}</span>`).join('')}
        </div>
      </div>
      <section class="evaluation-grid-card">
        <div class="grid-help"><strong>${state.students.length} élèves</strong><span>${state.competencies.length} compétences</span><span>Cliquer sur une case pour changer son statut</span></div>
        <div id="evaluation-grid" class="evaluation-grid"></div>
      </section>
    </main>`;

  const mountEvaluationGrid = (): void => {
    const gridElement = root.querySelector<HTMLElement>('#evaluation-grid');
    if (!gridElement) return;
    const gridOptions: GridOptions<EvaluationRow> = {
      theme: evaluationTheme,
      rowData: evaluationRows(),
      columnDefs: evaluationColumns(),
      defaultColDef: { resizable: true, suppressMovable: true },
      getRowId: (params) => params.data.studentId,
      rowHeight: 52,
      headerHeight: 72,
      groupHeaderHeight: 38,
      singleClickEdit: true,
      stopEditingWhenCellsLoseFocus: true,
      quickFilterText: evaluationSearch,
      onCellValueChanged: saveEvaluationStatus,
      ensureDomOrder: true,
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
        : evaluationsPage();
    root.innerHTML = `<div class="app-shell">${sidebar()}${pageContent}</div>`;
    if (page === 'evaluations') window.requestAnimationFrame(mountEvaluationGrid);
  };

  const persist = (): void => { saveAppState(state); render(); };

  interface ModalOptions { eyebrow: string; title: string; fields: string; submit: string; save: (data: FormData) => void }
  type AppDialog = HTMLDialogElement & { close: () => void; showModal: () => void };
  const closeModal = (): void => document.querySelector<AppDialog>('#app-modal')?.close();
  const error = (message: string): void => { const element = document.querySelector('#form-error'); if (element) element.textContent = message; };
  const field = (label: string, name: string, value = '', placeholder = ''): string => `<label class="form-field"><span>${label}</span><input name="${name}" value="${escapeHtml(value)}" placeholder="${placeholder}" required></label>`;

  const modal = (options: ModalOptions): void => {
    document.querySelector('#app-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<dialog class="modal" id="app-modal"><form class="modal-card" id="modal-form"><div class="modal-header"><div><p class="eyebrow">${escapeHtml(options.eyebrow)}</p><h2>${escapeHtml(options.title)}</h2></div><button type="button" class="icon-button" data-modal-close>${icons.close}</button></div><div class="modal-content">${options.fields}<p class="form-error" id="form-error"></p></div><div class="modal-actions"><button type="button" class="secondary-button" data-modal-close>Annuler</button><button class="primary-button" type="submit">${options.submit}</button></div></form></dialog>`);
    const dialog = document.querySelector<AppDialog>('#app-modal');
    dialog?.showModal();
    dialog?.addEventListener('click', (event) => { if (event.target === dialog) closeModal(); });
    document.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
    document.querySelector<HTMLFormElement>('#modal-form')?.addEventListener('submit', (event) => { event.preventDefault(); options.save(new FormData(event.currentTarget as HTMLFormElement)); });
    window.setTimeout(() => dialog?.querySelector<HTMLElement>('input,textarea,select')?.focus(), 50);
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
      if (item) Object.assign(item, { name, nationalEducationNumber: code, groupId }); else state.competencies.push({ id: uid('competency'), subjectId: selectedSubjectId, groupId, name, nationalEducationNumber: code });
      closeModal(); persist();
    } });
  };

  const studentModal = (id?: string): void => {
    const student = state.students.find((item) => item.id === id);
    modal({ eyebrow: 'Classe', title: student ? 'Modifier l’élève' : 'Nouvel élève', fields: field('Prénom', 'firstName', student?.firstName, 'Ex. Camille'), submit: student ? 'Enregistrer' : 'Ajouter à la classe', save: (data) => {
      const firstName = String(data.get('firstName') ?? '').trim(); if (!firstName) return error('Indiquez le prénom de l’élève.');
      if (student) student.firstName = firstName; else { const created: Student = { id: uid('student'), firstName, manualNotes: [] }; state.students.push(created); selectedStudentId = created.id; }
      closeModal(); persist();
    } });
  };

  const noteModal = (studentId: string): void => {
    const student = state.students.find((item) => item.id === studentId); if (!student) return;
    modal({ eyebrow: student.firstName, title: 'Ajouter une note de suivi', fields: '<label class="form-field"><span>Observation</span><textarea name="text" rows="5" placeholder="Écrivez votre observation…" required></textarea><small>Cette note reste enregistrée localement.</small></label>', submit: 'Enregistrer la note', save: (data) => {
      const text = String(data.get('text') ?? '').trim(); if (!text) return error('Écrivez une observation.'); student.manualNotes.push({ id: uid('note'), text, createdAt: new Date().toISOString() }); closeModal(); persist();
    } });
  };

  const descendants = (id: string): string[] => [id, ...state.groups.filter((group) => group.parentGroupId === id).flatMap((group) => descendants(group.id))];

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!button) return;
    const action = button.dataset.action; const id = button.dataset.id;
    if (action === 'navigate') { page = button.dataset.page as Page; render(); }
    else if (action === 'select-subject' && id) { selectedSubjectId = id; render(); }
    else if (action === 'new-subject') subjectModal();
    else if (action === 'edit-subject' && id) subjectModal(id);
    else if (action === 'new-group') groupModal();
    else if (action === 'new-subgroup' && id) groupModal(undefined, id);
    else if (action === 'edit-group' && id) groupModal(id);
    else if (action === 'toggle-group' && id) { collapsedGroups.has(id) ? collapsedGroups.delete(id) : collapsedGroups.add(id); render(); }
    else if (action === 'new-competency') competencyModal(undefined, button.dataset.groupId);
    else if (action === 'edit-competency' && id) competencyModal(id);
    else if (action === 'delete-competency' && id && window.confirm('Supprimer cette compétence ?')) { state.competencies = state.competencies.filter((item) => item.id !== id); state.competencyStatuses = state.competencyStatuses.filter((item) => item.competencyId !== id); persist(); }
    else if (action === 'delete-group' && id && window.confirm('Supprimer ce groupe et ses sous-groupes ? Les compétences seront conservées sans groupe.')) { const ids = descendants(id); state.groups = state.groups.filter((group) => !ids.includes(group.id)); state.competencies.forEach((item) => { if (item.groupId && ids.includes(item.groupId)) item.groupId = undefined; }); persist(); }
    else if (action === 'new-student') studentModal();
    else if (action === 'edit-student' && id) studentModal(id);
    else if (action === 'select-student' && id) { selectedStudentId = id; render(); }
    else if (action === 'new-note' && id) noteModal(id);
    else if (action === 'delete-note' && id && button.dataset.studentId && window.confirm('Supprimer cette note ?')) { const student = state.students.find((item) => item.id === button.dataset.studentId); if (student) student.manualNotes = student.manualNotes.filter((note) => note.id !== id); persist(); }
    else if (action === 'delete-student' && id && window.confirm('Supprimer cet élève et toutes ses notes ?')) { state.students = state.students.filter((student) => student.id !== id); state.competencyStatuses = state.competencyStatuses.filter((item) => item.studentId !== id); selectedStudentId = state.students[0]?.id ?? ''; persist(); }
  });

  root.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-search]'); if (!input) return;
    if (input.dataset.search === 'evaluations') {
      evaluationSearch = input.value;
      evaluationGridApi?.setGridOption('quickFilterText', evaluationSearch);
      return;
    }
    if (input.dataset.search === 'competencies') competencySearch = input.value; else studentSearch = input.value;
    const position = input.selectionStart ?? input.value.length; render(); const next = root.querySelector<HTMLInputElement>(`[data-search="${input.dataset.search}"]`); next?.focus(); next?.setSelectionRange(position, position);
  });

  render();
};
