import { DatabaseSync } from 'node:sqlite';

import type { AppState } from './app-state';

type StreamType = 'subject' | 'group' | 'competency' | 'student' | 'assessment' | 'dictation' | 'dictation-result';
type EventType = 'upsert' | 'tombstone';

interface StoredEvent {
  stream_type: StreamType;
  stream_key: string;
  event_type: EventType;
  payload: string | null;
}

interface PendingEvent {
  streamType: StreamType;
  streamKey: string;
  eventType: EventType;
  payload?: string;
}

const emptyState = (): AppState => ({
  subjects: [],
  groups: [],
  competencies: [],
  students: [],
  competencyStatuses: [],
  dictations: [],
  dictationResults: [],
});

const assessmentCellKey = (studentId: string, competencyId: string): string =>
  JSON.stringify([studentId, competencyId]);

const dictationResultCellKey = (studentId: string, dictationId: string): string =>
  JSON.stringify([studentId, dictationId]);

const mapsFor = (state: AppState): Record<StreamType, Map<string, unknown>> => ({
  subject: new Map(state.subjects.map((item) => [item.id, item])),
  group: new Map(state.groups.map((item) => [item.id, item])),
  competency: new Map(state.competencies.map((item) => [item.id, item])),
  student: new Map(state.students.map((item) => [item.id, item])),
  assessment: new Map(state.competencyStatuses.map((item) => [
    assessmentCellKey(item.studentId, item.competencyId),
    item,
  ])),
  dictation: new Map(state.dictations.map((item) => [item.id, item])),
  'dictation-result': new Map(state.dictationResults.map((item) => [
    dictationResultCellKey(item.studentId, item.dictationId),
    item,
  ])),
});

const eventsBetween = (before: AppState, after: AppState): PendingEvent[] => {
  const oldMaps = mapsFor(before);
  const newMaps = mapsFor(after);
  const events: PendingEvent[] = [];

  (Object.keys(newMaps) as StreamType[]).forEach((streamType) => {
    const oldItems = oldMaps[streamType];
    const newItems = newMaps[streamType];

    newItems.forEach((item, streamKey) => {
      const payload = JSON.stringify(item);
      const previous = oldItems.get(streamKey);
      if (previous === undefined || JSON.stringify(previous) !== payload) {
        events.push({ streamType, streamKey, eventType: 'upsert', payload });
      }
    });

    oldItems.forEach((_item, streamKey) => {
      if (!newItems.has(streamKey)) {
        events.push({ streamType, streamKey, eventType: 'tombstone' });
      }
    });
  });

  return events;
};

const parsePayload = (event: StoredEvent): unknown => {
  if (event.event_type === 'tombstone' || event.payload === null) return undefined;
  return JSON.parse(event.payload);
};

/**
 * Append-only SQLite event log. `current_events` is a normal SQLite view (not
 * a virtual table): it exposes the latest event for each logical stream. The
 * in-memory AppState snapshot is rebuilt from that view when the store opens.
 */
export class SqliteEventStore {
  private readonly database: DatabaseSync;
  private snapshot: AppState;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    const existingEventsSql = this.database.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'",
    ).all()[0]?.sql;
    if (typeof existingEventsSql === 'string' && !existingEventsSql.includes("'dictation'")) {
      this.database.exec(`
        DROP VIEW IF EXISTS current_assessments;
        DROP VIEW IF EXISTS current_events;
        ALTER TABLE events RENAME TO events_before_dictations;
        CREATE TABLE events (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          stream_type TEXT NOT NULL CHECK (
            stream_type IN ('subject', 'group', 'competency', 'student', 'assessment', 'dictation', 'dictation-result')
          ),
          stream_key TEXT NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('upsert', 'tombstone')),
          payload TEXT,
          occurred_at TEXT NOT NULL,
          CHECK (
            (event_type = 'upsert' AND payload IS NOT NULL) OR
            (event_type = 'tombstone' AND payload IS NULL)
          )
        );
        INSERT INTO events SELECT * FROM events_before_dictations;
        DROP TABLE events_before_dictations;
      `);
    }
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_type TEXT NOT NULL CHECK (
          stream_type IN ('subject', 'group', 'competency', 'student', 'assessment', 'dictation', 'dictation-result')
        ),
        stream_key TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('upsert', 'tombstone')),
        payload TEXT,
        occurred_at TEXT NOT NULL,
        CHECK (
          (event_type = 'upsert' AND payload IS NOT NULL) OR
          (event_type = 'tombstone' AND payload IS NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS events_by_stream
        ON events (stream_type, stream_key, sequence DESC);

      CREATE VIEW IF NOT EXISTS current_events AS
      SELECT event.sequence, event.stream_type, event.stream_key,
             event.event_type, event.payload, event.occurred_at
      FROM events AS event
      WHERE NOT EXISTS (
        SELECT 1
        FROM events AS later
        WHERE later.stream_type = event.stream_type
          AND later.stream_key = event.stream_key
          AND later.sequence > event.sequence
      );

      CREATE VIEW IF NOT EXISTS current_assessments AS
      SELECT sequence, stream_key AS cell_key, event_type, payload, occurred_at
      FROM current_events
      WHERE stream_type = 'assessment';

      CREATE VIEW IF NOT EXISTS current_dictations AS
      SELECT sequence, stream_type, stream_key, event_type, payload, occurred_at
      FROM current_events
      WHERE stream_type IN ('dictation', 'dictation-result');
    `);
    this.snapshot = this.rebuildSnapshot();
  }

  loadSnapshot(): AppState | null {
    const count = this.database.prepare('SELECT COUNT(*) AS count FROM events').all()[0]?.count;
    if (Number(count) === 0) return null;
    return structuredClone(this.snapshot);
  }

  replaceSnapshot(nextSnapshot: AppState): void {
    const safeSnapshot = structuredClone(nextSnapshot);
    const pending = eventsBetween(this.snapshot, safeSnapshot);
    if (pending.length === 0) return;

    const insert = this.database.prepare(`
      INSERT INTO events (stream_type, stream_key, event_type, payload, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const occurredAt = new Date().toISOString();

    this.database.exec('BEGIN IMMEDIATE');
    try {
      pending.forEach((event) => {
        insert.run(
          event.streamType,
          event.streamKey,
          event.eventType,
          event.payload ?? null,
          occurredAt,
        );
      });
      this.database.exec('COMMIT');
      this.snapshot = safeSnapshot;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }

  private rebuildSnapshot(): AppState {
    const snapshot = emptyState();
    const events = this.database.prepare(`
      SELECT stream_type, stream_key, event_type, payload
      FROM current_events
      ORDER BY sequence
    `).all() as unknown as StoredEvent[];

    events.forEach((event) => {
      const payload = parsePayload(event);
      if (payload === undefined) return;

      switch (event.stream_type) {
        case 'subject': snapshot.subjects.push(payload as AppState['subjects'][number]); break;
        case 'group': snapshot.groups.push(payload as AppState['groups'][number]); break;
        case 'competency': snapshot.competencies.push(payload as AppState['competencies'][number]); break;
        case 'student': snapshot.students.push(payload as AppState['students'][number]); break;
        case 'assessment': snapshot.competencyStatuses.push(payload as AppState['competencyStatuses'][number]); break;
        case 'dictation': snapshot.dictations.push(payload as AppState['dictations'][number]); break;
        case 'dictation-result': snapshot.dictationResults.push(payload as AppState['dictationResults'][number]); break;
      }
    });

    return snapshot;
  }
}
