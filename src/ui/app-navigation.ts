import type { LegacyModalBridge } from './legacy-modal';

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
  modal: LegacyModalBridge;
}

export interface LegacyAppController {
  navigate: (page: AppPage) => void;
  destroy: () => void;
}
