import { contextBridge, ipcRenderer } from 'electron';

import type { AppState } from './app-state';
import { PDF_EXPORT_CHANNELS, type PdfExportApi } from './pdf-export-contract';
import { STORAGE_CHANNELS, type StorageApi } from './storage-contract';

const storage: StorageApi = {
  loadSnapshot: () => ipcRenderer.invoke(STORAGE_CHANNELS.load) as Promise<AppState | null>,
  saveSnapshot: (state) => ipcRenderer.invoke(STORAGE_CHANNELS.save, state) as Promise<void>,
};

contextBridge.exposeInMainWorld('storage', storage);

const pdfExport: PdfExportApi = {
  exportStudentReport: (request) => ipcRenderer.invoke(
    PDF_EXPORT_CHANNELS.studentReport,
    request,
  ) as ReturnType<PdfExportApi['exportStudentReport']>,
};

contextBridge.exposeInMainWorld('pdfExport', pdfExport);
