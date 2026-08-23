import type { AppModalBridge } from './app-modal';
import type { CompetenciesPageController, CompetenciesPageSnapshot } from './competencies-page';
import type { DictationsPageController, DictationsPageSnapshot } from './dictations-page';
import type { EvaluationsPageController, EvaluationsPageSnapshot } from './evaluations-page';
import type { StudentsPageController, StudentsPageSnapshot } from './students-page';

export type AppPage = 'competencies' | 'students' | 'evaluations' | 'dictations';

export interface AppNavigationCounts {
  competencies: number;
  students: number;
  evaluations: number;
  dictations: number;
}

export interface AppShellSnapshot {
  page: AppPage;
  counts: AppNavigationCounts;
}

export interface AppOptions {
  onShellChange: (snapshot: AppShellSnapshot) => void;
  onCompetenciesChange: (snapshot?: CompetenciesPageSnapshot) => void;
  onDictationsChange: (snapshot?: DictationsPageSnapshot) => void;
  onEvaluationsChange: (snapshot?: EvaluationsPageSnapshot) => void;
  onStudentsChange: (snapshot?: StudentsPageSnapshot) => void;
  modal: AppModalBridge;
}

export interface AppController {
  competencies: CompetenciesPageController;
  dictations: DictationsPageController;
  evaluations: EvaluationsPageController;
  students: StudentsPageController;
  navigate: (page: AppPage) => void;
  destroy: () => void;
}
