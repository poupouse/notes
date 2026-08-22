import { contextBridge, ipcRenderer } from 'electron';

import type { AppState } from './app-state';
import { STORAGE_CHANNELS, type StorageApi } from './storage-contract';

const storage: StorageApi = {
  loadSnapshot: () => ipcRenderer.invoke(STORAGE_CHANNELS.load) as Promise<AppState | null>,
  saveSnapshot: (state) => ipcRenderer.invoke(STORAGE_CHANNELS.save, state) as Promise<void>,
};

contextBridge.exposeInMainWorld('storage', storage);
