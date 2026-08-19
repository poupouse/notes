import type {
  Competency,
  CompetencyGroup,
  StudentCompetencyStatus,
  Student,
  Subject,
} from './domain';

export interface AppState {
  subjects: Subject[];
  groups: CompetencyGroup[];
  competencies: Competency[];
  students: Student[];
  competencyStatuses: StudentCompetencyStatus[];
}

const STORAGE_KEY = 'carnet-classe-data-v1';

const cloneInitialState = (): AppState =>
  JSON.parse(JSON.stringify(initialState)) as AppState;

const initialState: AppState = {
  subjects: [
    { id: 'subject-maths', name: 'Mathématiques' },
    { id: 'subject-french', name: 'Français' },
    { id: 'subject-science', name: 'Sciences' },
  ],
  groups: [
    { id: 'group-numbers', subjectId: 'subject-maths', name: 'Nombres et calculs' },
    { id: 'group-mental', subjectId: 'subject-maths', parentGroupId: 'group-numbers', name: 'Calcul mental' },
    { id: 'group-problems', subjectId: 'subject-maths', name: 'Résolution de problèmes' },
    { id: 'group-language', subjectId: 'subject-french', name: 'Étude de la langue' },
    { id: 'group-grammar', subjectId: 'subject-french', parentGroupId: 'group-language', name: 'Grammaire' },
    { id: 'group-reading', subjectId: 'subject-french', name: 'Lecture et compréhension' },
    { id: 'group-living', subjectId: 'subject-science', name: 'Le vivant' },
  ],
  competencies: [
    { id: 'competency-1', subjectId: 'subject-maths', groupId: 'group-mental', name: 'Mémoriser les tables de multiplication', nationalEducationNumber: 'C2-MATH-07' },
    { id: 'competency-2', subjectId: 'subject-maths', groupId: 'group-numbers', name: 'Comparer et ranger des nombres entiers', nationalEducationNumber: 'C2-MATH-03' },
    { id: 'competency-3', subjectId: 'subject-maths', groupId: 'group-problems', name: 'Résoudre des problèmes à une étape', nationalEducationNumber: 'C2-MATH-12' },
    { id: 'competency-4', subjectId: 'subject-french', groupId: 'group-grammar', name: 'Identifier les constituants d’une phrase simple', nationalEducationNumber: 'C2-FRA-18' },
    { id: 'competency-5', subjectId: 'subject-french', groupId: 'group-reading', name: 'Lire et comprendre un texte adapté', nationalEducationNumber: 'C2-FRA-05' },
    { id: 'competency-6', subjectId: 'subject-science', groupId: 'group-living', name: 'Identifier les besoins vitaux des êtres vivants', nationalEducationNumber: 'C2-QLM-14' },
  ],
  students: [
    {
      id: 'student-1',
      firstName: 'Alice',
      manualNotes: [{ id: 'note-1', text: 'Très bonne participation orale cette semaine.', createdAt: '2026-08-17T09:15:00.000Z' }],
    },
    {
      id: 'student-2',
      firstName: 'Baptiste',
      manualNotes: [{ id: 'note-2', text: 'Penser à vérifier la copie des devoirs.', createdAt: '2026-08-18T15:40:00.000Z' }],
    },
    { id: 'student-3', firstName: 'Chloé', manualNotes: [] },
    { id: 'student-4', firstName: 'Dylan', manualNotes: [] },
    { id: 'student-5', firstName: 'Emma', manualNotes: [] },
    { id: 'student-6', firstName: 'Félix', manualNotes: [] },
  ],
  competencyStatuses: [],
};

export const loadAppState = (): AppState => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (!savedState) return cloneInitialState();

    const parsedState = JSON.parse(savedState) as Partial<AppState>;
    if (
      !Array.isArray(parsedState.subjects) ||
      !Array.isArray(parsedState.groups) ||
      !Array.isArray(parsedState.competencies) ||
      !Array.isArray(parsedState.students)
    ) {
      return cloneInitialState();
    }

    return {
      subjects: parsedState.subjects,
      groups: parsedState.groups,
      competencies: parsedState.competencies,
      students: parsedState.students,
      competencyStatuses: Array.isArray(parsedState.competencyStatuses)
        ? parsedState.competencyStatuses
        : [],
    };
  } catch {
    return cloneInitialState();
  }
};

export const saveAppState = (state: AppState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
