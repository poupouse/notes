export interface EvaluationLegendItemSnapshot {
  label: string;
  display: string;
  inputCode: string | null;
  className: string;
}

export interface EvaluationSubjectSnapshot {
  id: string;
  name: string;
  competencyCount: number;
  colorIndex: number;
  selected: boolean;
}

export interface EvaluationsPageSnapshot {
  search: string;
  gridRevision: number;
  selectedSubjectName: string;
  totalStudentCount: number;
  selectedCompetencyCount: number;
  legend: EvaluationLegendItemSnapshot[];
  subjects: EvaluationSubjectSnapshot[];
}

export interface EvaluationsPageController {
  setSearch: (value: string) => void;
  selectSubject: (subjectId: string) => void;
  mountGrid: (element: HTMLElement) => void;
  unmountGrid: () => void;
}
