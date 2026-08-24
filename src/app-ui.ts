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
import { buildStudentReportHtml, type StudentReportMetric, type StudentReportPage } from './student-report';
import type { AppController, AppOptions, AppPage } from './ui/app-navigation';
import type { AppModalField, AppModalOption } from './ui/app-modal';
import type {
  CompetenciesPageSnapshot,
  CompetencyGroupSnapshot,
  CompetencyItemSnapshot,
} from './ui/competencies-page';
import type { DictationsPageSnapshot } from './ui/dictations-page';
import type { EvaluationsPageSnapshot } from './ui/evaluations-page';
import type {
  StudentDetailSnapshot,
  StudentSuccessGroupSnapshot,
  StudentsPageSnapshot,
} from './ui/students-page';

ModuleRegistry.registerModules([AllCommunityModule]);

interface EvaluationRow {
  studentId: string;
  studentName: string;
  subjectAverage?: number | null;
  [competencyId: string]: string | number | null | undefined;
}

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

export const startApp = async (
  options: AppOptions,
): Promise<AppController> => {

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
  let page: AppPage = 'competencies';
  let selectedSubjectId = state.subjects[0]?.id ?? '';
  let selectedStudentId = state.students[0]?.id ?? '';
  let competencySearch = '';
  let studentSearch = '';
  let evaluationSearch = '';
  let dictationSearch = '';
  let evaluationGridRevision = 0;
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

  const groupMatches = (group: CompetencyGroup): boolean => {
    const query = competencySearch.trim().toLocaleLowerCase('fr');
    if (!query) return true;
    return group.name.toLocaleLowerCase('fr').includes(query) ||
      state.competencies.some((item) => item.groupId === group.id && `${item.name} ${item.nationalEducationNumber}`.toLocaleLowerCase('fr').includes(query)) ||
      state.groups.filter((child) => child.parentGroupId === group.id).some(groupMatches);
  };

  const competencyItemSnapshot = (item: Competency): CompetencyItemSnapshot => ({
    id: item.id,
    name: item.name,
    nationalEducationNumber: item.nationalEducationNumber,
    canReorder: !competencySearch.trim(),
  });

  const competencyGroupSnapshot = (group: CompetencyGroup, depth = 0): CompetencyGroupSnapshot | undefined => {
    if (!groupMatches(group)) return undefined;
    const query = competencySearch.trim().toLocaleLowerCase('fr');
    const items = orderedCompetencies(state.competencies.filter((item) => item.groupId === group.id && (!query || `${item.name} ${item.nationalEducationNumber}`.toLocaleLowerCase('fr').includes(query))));
    const children = state.groups
      .filter((child) => child.parentGroupId === group.id)
      .map((child) => competencyGroupSnapshot(child, depth + 1))
      .filter((child): child is CompetencyGroupSnapshot => Boolean(child));
    return {
      id: group.id,
      name: group.name,
      depth,
      competencyCount: state.competencies.filter((item) => item.groupId === group.id).length,
      collapsed: collapsedGroups.has(group.id) && !query,
      competencies: items.map(competencyItemSnapshot),
      children,
    };
  };

  const competenciesSnapshot = (): CompetenciesPageSnapshot => {
    const subject = state.subjects.find((item) => item.id === selectedSubjectId);
    const groups = state.groups
      .filter((group) => group.subjectId === selectedSubjectId && !group.parentGroupId)
      .map((group) => competencyGroupSnapshot(group))
      .filter((group): group is CompetencyGroupSnapshot => Boolean(group));
    const ungrouped = orderedCompetencies(state.competencies.filter((item) => item.subjectId === selectedSubjectId && !item.groupId));
    return {
      search: competencySearch,
      selectedCompetencyCount: subjectCount(selectedSubjectId),
      subjects: state.subjects.map((item, index) => ({
        id: item.id,
        name: item.name,
        competencyCount: subjectCount(item.id),
        colorIndex: index % 5,
        selected: item.id === selectedSubjectId,
      })),
      selectedSubject: subject ? {
        id: subject.id,
        name: subject.name,
        groups,
        ungrouped: ungrouped.map(competencyItemSnapshot),
      } : undefined,
    };
  };

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

  const studentSuccessGroupSnapshot = (
    studentId: string,
    group: CompetencyGroup,
  ): StudentSuccessGroupSnapshot => {
    const children = state.groups.filter((item) => item.parentGroupId === group.id);
    return {
      id: group.id,
      name: group.name,
      rate: studentSuccessRate(studentId, groupTreeCompetencies(group.id)),
      colorIndex: evaluationGroupColorIndex(group.subjectId, group.id),
      children: children.map((child) => studentSuccessGroupSnapshot(studentId, child)),
    };
  };

  const studentDetailSnapshot = (student: Student): StudentDetailSnapshot => {
    const notes = [...student.manualNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const dictations = state.dictations.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      id: student.id,
      firstName: student.firstName,
      initials: initials(student.firstName),
      avatarColor: avatarColor(student.firstName),
      subjects: state.subjects.map((subject) => {
        const subjectCompetencies = state.competencies.filter((competency) => competency.subjectId === subject.id);
        const topGroups = state.groups.filter((group) => group.subjectId === subject.id && !group.parentGroupId);
        const ungrouped = subjectCompetencies.filter((competency) => !competency.groupId);
        const groups = topGroups.map((group) => studentSuccessGroupSnapshot(student.id, group));
        if (ungrouped.length) groups.push({
          id: `${subject.id}-ungrouped`,
          name: 'Sans groupe',
          rate: studentSuccessRate(student.id, ungrouped),
          colorIndex: topGroups.length % 8,
          children: [],
        });
        return {
          id: subject.id,
          name: subject.name,
          rate: studentSuccessRate(student.id, subjectCompetencies),
          groups,
        };
      }),
      dictations: dictations.map((dictation) => {
        const rate = dictationRate(student.id, dictation);
        return {
          id: dictation.id,
          name: dictation.name,
          rate: typeof rate === 'number' ? rate : null,
          level: studentDictationLevel(student.id, dictation),
        };
      }),
      notes: notes.map((note) => ({
        id: note.id,
        text: note.text,
        formattedDate: formatDate(note.createdAt),
      })),
    };
  };

  const studentsSnapshot = (): StudentsPageSnapshot => {
    const query = studentSearch.trim().toLocaleLowerCase('fr');
    const students = [...state.students].filter((student) => student.firstName.toLocaleLowerCase('fr').includes(query)).sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    const selected = state.students.find((student) => student.id === selectedStudentId);
    return {
      search: studentSearch,
      totalStudentCount: state.students.length,
      students: students.map((student) => ({
        id: student.id,
        firstName: student.firstName,
        initials: initials(student.firstName),
        avatarColor: avatarColor(student.firstName),
        noteCount: student.manualNotes.length,
        notePreview: student.manualNotes[0]?.text ?? 'Aucune observation',
        selected: student.id === selectedStudentId,
      })),
      selected: selected ? studentDetailSnapshot(selected) : undefined,
    };
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
    if (percentage < 60) container.classList.add('difficulty');
    const label = document.createElement('strong');
    label.textContent = `${percentage} %`;
    const track = document.createElement('span');
    const bar = document.createElement('i');
    bar.style.width = `${percentage}%`;
    track.append(bar);
    container.append(label, track);
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

  const evaluationsSnapshot = (): EvaluationsPageSnapshot => {
    const selectedSubject = state.subjects.find((subject) => subject.id === evaluationSubjectId);
    const selectedCompetencyCount = state.competencies.filter((competency) => competency.subjectId === evaluationSubjectId).length;
    return {
      search: evaluationSearch,
      gridRevision: evaluationGridRevision,
      selectedSubjectName: selectedSubject?.name ?? 'Matière',
      totalStudentCount: state.students.length,
      selectedCompetencyCount,
      legend: statusOptions.map((option) => ({
        label: option.label,
        display: option.display,
        inputCode: option.inputCode,
        className: option.className,
      })),
      subjects: state.subjects.map((subject, index) => ({
        id: subject.id,
        name: subject.name,
        competencyCount: state.competencies.filter((competency) => competency.subjectId === subject.id).length,
        colorIndex: index % 5,
        selected: subject.id === evaluationSubjectId,
      })),
    };
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

  const dictationsSnapshot = (): DictationsPageSnapshot => {
    const query = dictationSearch.trim().toLocaleLowerCase('fr');
    const students = state.students.slice()
      .filter((student) => student.firstName.toLocaleLowerCase('fr').includes(query))
      .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
    const dictations = state.dictations.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      search: dictationSearch,
      totalStudentCount: state.students.length,
      students: students.map((student) => ({
        id: student.id,
        firstName: student.firstName,
        level: student.dictationLevel ?? 1,
      })),
      dictations: dictations.map((dictation) => ({
        id: dictation.id,
        name: dictation.name,
        wordCounts: dictationWordCounts(dictation),
        average: dictationAverage(dictation),
      })),
      scores: students.flatMap((student) => dictations.map((dictation) => {
        const rate = dictationRate(student.id, dictation);
        const level = studentDictationLevel(student.id, dictation);
        const wordCount = dictationWordCountForStudent(student.id, dictation);
        const result = state.dictationResults.find((item) =>
          item.studentId === student.id && item.dictationId === dictation.id);
        return {
          studentId: student.id,
          dictationId: dictation.id,
          kind: rate === 'absent' ? 'absent' as const : rate === null ? 'empty' as const : 'rate' as const,
          level,
          wordCount,
          rate: typeof rate === 'number' ? rate : undefined,
          mistakeCount: result?.mistakeCount,
        };
      })),
    };
  };

  const mountEvaluationGrid = (gridElement: HTMLElement): void => {
    evaluationGridApi?.destroy();
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
    if (page !== 'evaluations') {
      evaluationGridApi?.destroy();
      evaluationGridApi = undefined;
    }
    options.onCompetenciesChange(page === 'competencies' ? competenciesSnapshot() : undefined);
    options.onDictationsChange(page === 'dictations' ? dictationsSnapshot() : undefined);
    options.onEvaluationsChange(page === 'evaluations' ? evaluationsSnapshot() : undefined);
    options.onStudentsChange(page === 'students' ? studentsSnapshot() : undefined);
    options.onShellChange({
      page,
      counts: {
        competencies: state.competencies.length,
        students: state.students.length,
        evaluations: state.competencyStatuses.length,
        dictations: state.dictations.length,
      },
    });
  };

  const persist = (): void => {
    void saveAppState(state).catch((error: unknown) => {
      console.error('Unable to persist application state', error);
    });
    render();
  };

  const closeModal = options.modal.close;
  const error = options.modal.setError;
  const field = (label: string, name: string, value = '', placeholder = ''): AppModalField => ({
    kind: 'input', name, label, value, placeholder, required: true,
  });
  const modal = options.modal.open;

  const confirmDeletion = (title: string, message: string, remove: () => void): void => {
    modal({
      eyebrow: 'Confirmation',
      title,
      fields: [{ kind: 'message', text: message, className: 'confirmation-message' }],
      submit: 'Supprimer',
      destructive: true,
      save: () => { closeModal(); remove(); },
    });
  };

  const subjectModal = (id?: string): void => {
    const subject = state.subjects.find((item) => item.id === id);
    modal({ eyebrow: 'Référentiel', title: subject ? 'Renommer la matière' : 'Nouvelle matière', fields: [field('Nom de la matière', 'name', subject?.name, 'Ex. Histoire & Géographie')], submit: subject ? 'Enregistrer' : 'Créer la matière', save: (data) => {
      const name = String(data.get('name') ?? '').trim(); if (!name) return error('Indiquez un nom de matière.');
      if (subject) subject.name = name; else { const created = { id: uid('subject'), name }; state.subjects.push(created); selectedSubjectId = created.id; }
      closeModal(); persist();
    } });
  };

  const groupModal = (id?: string, parentGroupId?: string): void => {
    const group = state.groups.find((item) => item.id === id);
    const parent = state.groups.find((item) => item.id === parentGroupId);
    modal({ eyebrow: parent ? `Dans ${parent.name}` : 'Organisation', title: group ? 'Modifier le groupe' : parent ? 'Nouveau sous-groupe' : 'Nouveau groupe', fields: [field('Nom du groupe', 'name', group?.name, 'Ex. Géométrie et mesures')], submit: group ? 'Enregistrer' : 'Créer le groupe', save: (data) => {
      const name = String(data.get('name') ?? '').trim(); if (!name) return error('Indiquez un nom de groupe.');
      if (group) group.name = name; else state.groups.push({ id: uid('group'), subjectId: selectedSubjectId, parentGroupId, name });
      closeModal(); persist();
    } });
  };

  const groupOptions = (): AppModalOption[] => {
    const options: AppModalOption[] = [{ value: '', label: 'Sans groupe' }];
    const add = (parentId?: string, depth = 0): void => state.groups
      .filter((group) => group.subjectId === selectedSubjectId && group.parentGroupId === parentId)
      .forEach((group) => {
        options.push({ value: group.id, label: `${'— '.repeat(depth)}${group.name}` });
        add(group.id, depth + 1);
      });
    add();
    return options;
  };

  const competencyModal = (id?: string, preferredGroup?: string): void => {
    const item = state.competencies.find((competency) => competency.id === id); if (!selectedSubjectId) return;
    modal({ eyebrow: 'Référentiel pédagogique', title: item ? 'Modifier la compétence' : 'Nouvelle compétence', fields: [field('Intitulé', 'name', item?.name, 'Ex. Poser et effectuer une addition'), field('Numéro Éducation nationale', 'code', item?.nationalEducationNumber, 'Ex. C2-MATH-08'), { kind: 'select', name: 'groupId', label: 'Groupe', value: item?.groupId ?? preferredGroup ?? '', options: groupOptions() }], submit: item ? 'Enregistrer' : 'Ajouter la compétence', save: (data) => {
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
    modal({ eyebrow: 'Classe', title: student ? 'Modifier l’élève' : 'Nouvel élève', fields: [field('Prénom', 'firstName', student?.firstName, 'Ex. Camille')], submit: student ? 'Enregistrer' : 'Ajouter à la classe', save: (data) => {
      const firstName = String(data.get('firstName') ?? '').trim(); if (!firstName) return error('Indiquez le prénom de l’élève.');
      if (student) student.firstName = firstName; else { const created: Student = { id: uid('student'), firstName, manualNotes: [], dictationLevel: 1 }; state.students.push(created); selectedStudentId = created.id; }
      closeModal(); persist();
    } });
  };

  const noteModal = (studentId: string): void => {
    const student = state.students.find((item) => item.id === studentId); if (!student) return;
    modal({ eyebrow: student.firstName, title: 'Ajouter une note de suivi', fields: [{ kind: 'textarea', name: 'text', label: 'Observation', rows: 5, placeholder: 'Écrivez votre observation…', help: 'Cette note reste enregistrée localement.', required: true }], submit: 'Enregistrer la note', save: (data) => {
      const text = String(data.get('text') ?? '').trim(); if (!text) return error('Écrivez une observation.'); student.manualNotes.push({ id: uid('note'), text, createdAt: new Date().toISOString() }); closeModal(); persist();
    } });
  };

  const studentReportModal = (): void => {
    const groupCheckboxes = (subjectId: string, parentGroupId?: string, depth = 0): AppModalField[] =>
      state.groups
        .filter((group) => group.subjectId === subjectId && group.parentGroupId === parentGroupId)
        .flatMap((group) => [
          {
            kind: 'checkbox' as const,
            name: `report-group-${group.id}`,
            label: `${depth ? 'Sous-groupe' : 'Groupe'} : ${group.name}`,
            checked: true,
          },
          ...groupCheckboxes(subjectId, group.id, depth + 1),
        ]);
    const fields: AppModalField[] = state.subjects.map((subject) => ({
      kind: 'group',
      className: 'report-export-option-section',
      fields: [
        { kind: 'checkbox', name: `report-subject-${subject.id}`, label: `Matière : ${subject.name}`, checked: true },
        ...groupCheckboxes(subject.id),
      ],
    }));
    if (state.dictations.length) fields.push({
      kind: 'group',
      className: 'report-export-option-section dictation-export-option',
      fields: [{ kind: 'checkbox', name: 'report-dictations', label: 'Dictées : tous les résultats', checked: true }],
    });

    modal({
      eyebrow: 'Suivi des familles',
      title: 'Exporter la synthèse PDF',
      fields,
      submit: 'Choisir l’emplacement',
      save: async (data) => {
        const selectedSubjectIds = new Set(state.subjects
          .filter((subject) => data.has(`report-subject-${subject.id}`))
          .map((subject) => subject.id));
        const selectedGroupIds = new Set(state.groups
          .filter((group) => data.has(`report-group-${group.id}`))
          .map((group) => group.id));
        const includeDictations = data.has('report-dictations');
        if (!selectedSubjectIds.size && !selectedGroupIds.size && !includeDictations) {
          error('Sélectionnez au moins une matière, un groupe, un sous-groupe ou les dictées.');
          return;
        }

        const reportMetrics = (studentId: string, subjectId: string): StudentReportMetric[] => {
          const metrics: StudentReportMetric[] = [];
          const addGroups = (parentGroupId?: string, depth = 0): void => {
            state.groups
              .filter((group) => group.subjectId === subjectId && group.parentGroupId === parentGroupId)
              .forEach((group) => {
                const children = state.groups.filter((child) => child.parentGroupId === group.id);
                if (selectedGroupIds.has(group.id)) metrics.push({
                  id: group.id,
                  name: group.name,
                  kind: depth ? 'subgroup' : 'group',
                  rate: studentSuccessRate(studentId, groupTreeCompetencies(group.id)),
                  colorIndex: evaluationGroupColorIndex(subjectId, group.id),
                  colored: depth > 0 || children.length === 0,
                });
                addGroups(group.id, depth + 1);
              });
          };
          addGroups();
          return metrics;
        };
        const orderedStudents = state.students.slice().sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr'));
        const reportStudents: StudentReportPage[] = orderedStudents.map((student) => ({
          id: student.id,
          firstName: student.firstName,
          subjects: state.subjects
            .filter((subject) => selectedSubjectIds.has(subject.id) || state.groups.some((group) =>
              group.subjectId === subject.id && selectedGroupIds.has(group.id)))
            .map((subject) => ({
              id: subject.id,
              name: subject.name,
              rate: selectedSubjectIds.has(subject.id)
                ? studentSuccessRate(student.id, state.competencies.filter((competency) => competency.subjectId === subject.id))
                : undefined,
              metrics: reportMetrics(student.id, subject.id),
            })),
          dictations: includeDictations ? state.dictations
            .slice()
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((dictation) => ({
              id: dictation.id,
              name: dictation.name,
              level: studentDictationLevel(student.id, dictation),
              result: dictationRate(student.id, dictation),
            })) : undefined,
        }));
        try {
          const today = new Date();
          const result = await window.pdfExport.exportStudentReport({
            html: buildStudentReportHtml({ generatedAt: today, students: reportStudents }),
            defaultFileName: `synthese-resultats-${today.toISOString().slice(0, 10)}.pdf`,
          });
          if (result.status === 'saved' || result.status === 'cancelled') closeModal();
        } catch (exportError) {
          console.error('Unable to export student report', exportError);
          error('Le PDF n’a pas pu être créé. Vérifiez l’emplacement choisi puis réessayez.');
        }
      },
    });
  };

  const dictationModal = (id?: string): void => {
    const dictation = state.dictations.find((item) => item.id === id);
    const wordCounts = dictation ? dictationWordCounts(dictation) : [20, 30, 40];
    modal({
      eyebrow: 'Évaluation / Dictée',
      title: dictation ? 'Modifier la dictée' : 'Nouvelle dictée',
      fields: [
        field('Nom de la dictée', 'name', dictation?.name, 'Ex. Dictée 1'),
        {
          kind: 'group',
          className: 'dictation-word-count-fields',
          fields: ([1, 2, 3] as DictationLevel[]).map((level) => ({
            kind: 'input',
            inputType: 'number',
            name: `level${level}Words`,
            label: `Niveau ${level}`,
            value: wordCounts[level - 1],
            min: 1,
            step: 1,
            required: true,
            help: 'Nombre de mots',
          })),
        },
        { kind: 'message', text: 'Chaque élève sera calculé avec le total correspondant à son niveau.', className: 'form-hint' },
      ],
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
      fields: [
        { kind: 'message', text: 'Ces niveaux sont enregistrés pour les prochaines dictées et appliqués immédiatement aux dictées sans résultat. Les dictées déjà notées conservent leur niveau historique.', className: 'form-hint' },
        {
          kind: 'group',
          className: 'dictation-level-list',
          fields: students.map((student) => ({
            kind: 'select',
            name: `level-${student.id}`,
            label: student.firstName,
            value: student.dictationLevel ?? 1,
            options: ([1, 2, 3] as DictationLevel[]).map((level) => ({ value: level, label: `Niveau ${level}` })),
          })),
        },
      ],
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
      fields: [
        {
          kind: 'select',
          name: 'level',
          label: 'Niveau de l’élève',
          value: level,
          options: ([1, 2, 3] as DictationLevel[]).map((candidate) => ({ value: candidate, label: `Niveau ${candidate} · ${wordCounts[candidate - 1]} mots` })),
          help: 'Ce choix sera repris par défaut pour les prochaines dictées.',
        },
        {
          kind: 'input',
          inputType: 'number',
          name: 'mistakeCount',
          label: 'Nombre d’erreurs',
          value: existing?.mistakeCount ?? '',
          min: 0,
          max: Math.max(...wordCounts),
          step: 1,
          placeholder: 'Laisser vide pour effacer',
          help: 'Une saisie vide conserve le niveau mais efface le résultat.',
        },
        { kind: 'checkbox', name: 'absent', label: 'Élève absent pour cette dictée', checked: existing?.absent },
      ],
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

  render();

  return {
    competencies: {
      setSearch(value) {
        competencySearch = value;
        render();
      },
      selectSubject(subjectId) {
        selectedSubjectId = subjectId;
        render();
      },
      createSubject: subjectModal,
      editSubject: subjectModal,
      createGroup(parentGroupId) {
        groupModal(undefined, parentGroupId);
      },
      editGroup: groupModal,
      toggleGroup(groupId) {
        collapsedGroups.has(groupId) ? collapsedGroups.delete(groupId) : collapsedGroups.add(groupId);
        render();
      },
      removeGroup(groupId) {
        confirmDeletion('Supprimer ce groupe ?', 'Ses sous-groupes seront supprimés. Les compétences seront conservées sans groupe.', () => {
          const ids = descendants(groupId);
          state.groups = state.groups.filter((group) => !ids.includes(group.id));
          state.competencies.forEach((item) => {
            if (item.groupId && ids.includes(item.groupId)) item.groupId = undefined;
          });
          normalizeGroupOrder();
          persist();
        });
      },
      createCompetency(groupId) {
        competencyModal(undefined, groupId);
      },
      editCompetency: competencyModal,
      removeCompetency(competencyId) {
        confirmDeletion('Supprimer cette compétence ?', 'Les évaluations associées à cette compétence seront également supprimées.', () => {
          state.competencies = state.competencies.filter((item) => item.id !== competencyId);
          state.competencyStatuses = state.competencyStatuses.filter((item) => item.competencyId !== competencyId);
          persist();
        });
      },
      moveCompetency(competencyId, groupId, targetId, afterTarget) {
        if (moveCompetency(competencyId, groupId, targetId, afterTarget)) persist();
      },
    },
    evaluations: {
      setSearch(value) {
        evaluationSearch = value;
        options.onEvaluationsChange(page === 'evaluations' ? evaluationsSnapshot() : undefined);
        evaluationGridApi?.setGridOption('quickFilterText', evaluationSearch);
      },
      selectSubject(subjectId) {
        if (evaluationSubjectId === subjectId) return;
        evaluationGridApi?.destroy();
        evaluationGridApi = undefined;
        evaluationSubjectId = subjectId;
        evaluationGridRevision += 1;
        render();
      },
      mountGrid: mountEvaluationGrid,
      unmountGrid() {
        evaluationGridApi?.destroy();
        evaluationGridApi = undefined;
      },
    },
    dictations: {
      setSearch(value) {
        dictationSearch = value;
        render();
      },
      create: dictationModal,
      manageLevels: dictationLevelsModal,
      edit: dictationModal,
      remove(dictationId) {
        confirmDeletion('Supprimer cette dictée ?', 'Tous les résultats associés seront également supprimés.', () => {
          state.dictations = state.dictations.filter((item) => item.id !== dictationId);
          state.dictationResults = state.dictationResults.filter((item) => item.dictationId !== dictationId);
          persist();
        });
      },
      editResult: dictationResultModal,
    },
    students: {
      setSearch(value) {
        studentSearch = value;
        render();
      },
      select(studentId) {
        selectedStudentId = studentId;
        render();
      },
      create: studentModal,
      edit: studentModal,
      remove(studentId) {
        confirmDeletion('Supprimer cet élève ?', 'Ses notes et ses résultats seront également supprimés.', () => {
          state.students = state.students.filter((student) => student.id !== studentId);
          state.competencyStatuses = state.competencyStatuses.filter((item) => item.studentId !== studentId);
          state.dictationResults = state.dictationResults.filter((item) => item.studentId !== studentId);
          selectedStudentId = state.students[0]?.id ?? '';
          persist();
        });
      },
      addNote: noteModal,
      exportReport: studentReportModal,
      removeNote(studentId, noteId) {
        confirmDeletion('Supprimer cette note ?', 'Cette note de suivi ne sera plus visible.', () => {
          const student = state.students.find((item) => item.id === studentId);
          if (student) student.manualNotes = student.manualNotes.filter((note) => note.id !== noteId);
          persist();
        });
      },
    },
    navigate(nextPage) {
      if (page === nextPage) return;
      page = nextPage;
      render();
    },
    destroy() {
      evaluationGridApi?.destroy();
      evaluationGridApi = undefined;
      closeModal();
    },
  };
};
