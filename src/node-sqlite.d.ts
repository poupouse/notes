declare module 'node:sqlite' {
  export interface StatementSync {
    all(...values: unknown[]): Record<string, unknown>[];
    run(...values: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
