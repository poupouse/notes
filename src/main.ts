import { app, BrowserWindow, ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import type { AppState } from './app-state';
import { SqliteEventStore } from './sqlite-event-store';
import { STORAGE_CHANNELS } from './storage-contract';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

};

let eventStore: SqliteEventStore | undefined;

const isAppState = (value: unknown): value is AppState => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AppState>;
  return Array.isArray(candidate.subjects) &&
    Array.isArray(candidate.groups) &&
    Array.isArray(candidate.competencies) &&
    Array.isArray(candidate.students) &&
    Array.isArray(candidate.competencyStatuses);
};

const configureStorage = (): void => {
  const databaseName = `${os.hostname().replace(/[\\/:*?"<>|]/g, '_')}.sqlite`;
  eventStore = new SqliteEventStore(path.join(app.getPath('userData'), databaseName));

  ipcMain.handle(STORAGE_CHANNELS.load, () => eventStore?.loadSnapshot() ?? null);
  ipcMain.handle(STORAGE_CHANNELS.save, (_event, state: unknown) => {
    if (!isAppState(state)) throw new Error('Invalid application state');
    eventStore?.replaceSnapshot(state);
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  configureStorage();
  createWindow();
});

app.on('before-quit', () => {
  eventStore?.close();
  eventStore = undefined;
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
