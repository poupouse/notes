export interface CompetencyItemSnapshot {
  id: string;
  name: string;
  nationalEducationNumber: string;
  canReorder: boolean;
}

export interface CompetencyGroupSnapshot {
  id: string;
  name: string;
  depth: number;
  competencyCount: number;
  collapsed: boolean;
  competencies: CompetencyItemSnapshot[];
  children: CompetencyGroupSnapshot[];
}

export interface CompetencySubjectSnapshot {
  id: string;
  name: string;
  competencyCount: number;
  colorIndex: number;
  selected: boolean;
}

export interface SelectedCompetencySubjectSnapshot {
  id: string;
  name: string;
  groups: CompetencyGroupSnapshot[];
  ungrouped: CompetencyItemSnapshot[];
}

export interface CompetenciesPageSnapshot {
  search: string;
  selectedCompetencyCount: number;
  subjects: CompetencySubjectSnapshot[];
  selectedSubject?: SelectedCompetencySubjectSnapshot;
}

export interface CompetenciesPageController {
  setSearch: (value: string) => void;
  selectSubject: (subjectId: string) => void;
  createSubject: () => void;
  editSubject: (subjectId: string) => void;
  createGroup: (parentGroupId?: string) => void;
  editGroup: (groupId: string) => void;
  toggleGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  createCompetency: (groupId?: string) => void;
  editCompetency: (competencyId: string) => void;
  removeCompetency: (competencyId: string) => void;
  moveCompetency: (
    competencyId: string,
    groupId: string | undefined,
    targetId?: string,
    afterTarget?: boolean,
  ) => void;
}
