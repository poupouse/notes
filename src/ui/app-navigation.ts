import type { LegacyModalBridge } from './legacy-modal';
import type { DictationsPageController, DictationsPageSnapshot } from './dictations-page';
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

export interface LegacyAppOptions {
  onShellChange: (snapshot: AppShellSnapshot) => void;
  onDictationsChange: (snapshot?: DictationsPageSnapshot) => void;
  onStudentsChange: (snapshot?: StudentsPageSnapshot) => void;
  modal: LegacyModalBridge;
}

export interface LegacyAppController {
  dictations: DictationsPageController;
  students: StudentsPageController;
  navigate: (page: AppPage) => void;
  destroy: () => void;
}
