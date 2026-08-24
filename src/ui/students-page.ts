import type { DictationLevel } from '../domain';

export interface StudentListItemSnapshot {
  id: string;
  firstName: string;
  initials: string;
  avatarColor: number;
  noteCount: number;
  notePreview: string;
  selected: boolean;
}

export interface StudentSuccessGroupSnapshot {
  id: string;
  name: string;
  rate: number | null;
  colorIndex: number;
  children: StudentSuccessGroupSnapshot[];
}

export interface StudentSuccessSubjectSnapshot {
  id: string;
  name: string;
  rate: number | null;
  groups: StudentSuccessGroupSnapshot[];
}

export interface StudentDictationPointSnapshot {
  id: string;
  name: string;
  rate: number | null;
  level: DictationLevel;
}

export interface StudentNoteSnapshot {
  id: string;
  text: string;
  formattedDate: string;
}

export interface StudentDetailSnapshot {
  id: string;
  firstName: string;
  initials: string;
  avatarColor: number;
  subjects: StudentSuccessSubjectSnapshot[];
  dictations: StudentDictationPointSnapshot[];
  notes: StudentNoteSnapshot[];
}

export interface StudentsPageSnapshot {
  search: string;
  totalStudentCount: number;
  students: StudentListItemSnapshot[];
  selected?: StudentDetailSnapshot;
}

export interface StudentsPageController {
  setSearch: (value: string) => void;
  select: (studentId: string) => void;
  create: () => void;
  edit: (studentId: string) => void;
  remove: (studentId: string) => void;
  addNote: (studentId: string) => void;
  removeNote: (studentId: string, noteId: string) => void;
  exportReport: () => void;
}
