import type { DictationLevel } from '../domain';

export type DictationScoreKind = 'absent' | 'empty' | 'rate';

export interface DictationStudentSnapshot {
  id: string;
  firstName: string;
  level: DictationLevel;
}

export interface DictationColumnSnapshot {
  id: string;
  name: string;
  wordCounts: [number, number, number];
  average: number | null;
}

export interface DictationScoreSnapshot {
  studentId: string;
  dictationId: string;
  kind: DictationScoreKind;
  level: DictationLevel;
  wordCount: number;
  rate?: number;
  mistakeCount?: number;
}

export interface DictationsPageSnapshot {
  search: string;
  totalStudentCount: number;
  students: DictationStudentSnapshot[];
  dictations: DictationColumnSnapshot[];
  scores: DictationScoreSnapshot[];
}

export interface DictationsPageController {
  setSearch: (value: string) => void;
  create: () => void;
  manageLevels: () => void;
  edit: (dictationId: string) => void;
  remove: (dictationId: string) => void;
  editResult: (studentId: string, dictationId: string) => void;
}
