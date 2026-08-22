import type { AppState } from './app-state';

export const STORAGE_CHANNELS = {
  load: 'storage:load-snapshot',
  save: 'storage:save-snapshot',
} as const;

export interface StorageApi {
  loadSnapshot(): Promise<AppState | null>;
  saveSnapshot(state: AppState): Promise<void>;
}

declare global {
  interface Window {
    storage: StorageApi;
  }
}
