/**
 * Identifiers are strings so the storage layer can later use UUIDs, database
 * identifiers or imported identifiers without changing the domain model.
 */
export type StudentId = string;
export type SubjectId = string;
export type CompetencyGroupId = string;
export type CompetencyId = string;
export type AssessmentId = string;
export type CompetencyEvaluationId = string;
export type ManualNoteId = string;
export type DictationId = string;

/** ISO-8601 date and time, for example: 2026-08-19T14:30:00.000Z. */
export type IsoDateTime = string;

export interface ManualNote {
  id: ManualNoteId;
  text: string;
  createdAt: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export interface Student {
  id: StudentId;
  firstName: string;
  manualNotes: ManualNote[];
}

export interface Subject {
  id: SubjectId;
  name: string;
}

/**
 * A group belongs to one subject and provides an optional way to organise
 * related competencies inside that subject.
 */
export interface CompetencyGroup {
  id: CompetencyGroupId;
  subjectId: SubjectId;
  parentGroupId?: CompetencyGroupId;
  name: string;
}

export interface Competency {
  id: CompetencyId;
  subjectId: SubjectId;
  groupId?: CompetencyGroupId;
  name: string;

  /** Zero-based display position inside the competency's current group. */
  sortOrder?: number;

  /** Official identifier supplied by the French Ministry of Education. */
  nationalEducationNumber: string;
}

/** A named test can assess one or several competencies from one subject. */
export interface Assessment {
  id: AssessmentId;
  subjectId: SubjectId;
  name: string;
  competencyIds: CompetencyId[];
  scheduledAt?: IsoDateTime;
}

/** A spelling dictation whose score is based on its total word count. */
export interface Dictation {
  id: DictationId;
  name: string;
  totalWords: number;
  createdAt: IsoDateTime;
}

/** A student's raw result. The displayed success rate is derived from it. */
export interface StudentDictationResult {
  studentId: StudentId;
  dictationId: DictationId;
  mistakeCount?: number;
  absent?: boolean;
  updatedAt: IsoDateTime;
}

export enum CompetencyStatus {
  Validated = 'validated',
  Failed = 'failed',
  InProgress = 'in_progress',
  NotTaken = 'not_taken',
  Absent = 'absent',
}

/** Labels intended for the French user interface. */
export const COMPETENCY_STATUS_LABELS: Readonly<
  Record<CompetencyStatus, string>
> = {
  [CompetencyStatus.Validated]: 'Compétence validée',
  [CompetencyStatus.Failed]: 'Compétence ratée',
  [CompetencyStatus.InProgress]: "Compétence en cours d’acquisition",
  [CompetencyStatus.NotTaken]: 'Encore non passée',
  [CompetencyStatus.Absent]: 'Absent',
};

/**
 * Historical observation made during an assessment between a student and a
 * competency. Persistence is append-only: later observations supersede older
 * ones for the current matrix, without erasing the history.
 * There should be at most one record for a given
 * (studentId, assessmentId, competencyId) tuple.
 */
export interface CompetencyEvaluation {
  id: CompetencyEvaluationId;
  studentId: StudentId;
  assessmentId: AssessmentId;
  competencyId: CompetencyId;
  status: CompetencyStatus;
  updatedAt: IsoDateTime;
}

/** Current status displayed in the student-by-competency tracking matrix. */
export interface StudentCompetencyStatus {
  studentId: StudentId;
  competencyId: CompetencyId;
  status: CompetencyStatus;
  updatedAt: IsoDateTime;
}
