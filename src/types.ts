// IINA Plugin Types
// Type definitions for IINA plugin API (September 2025)

export interface BookmarkData {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description?: string;
  createdAt: string;
  tags?: string[];
}

export interface UIMessage {
  type: string;
  payload?: any;
  sourceUI?: 'sidebar' | 'overlay' | 'window';
}

export interface IINACore {
  status: {
    path?: string;
    currentTime?: number;
    metadata?: {
      title?: string;
    };
  };
  seek?: (time: number) => void;
}

export interface IINAConsole {
  log: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

export interface IINAPreferences {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
}

export interface IINAMenu {
  addItem: (item: any) => void;
  item: (title: string, action: () => void) => any;
}

export interface IINAEvent {
  on: (event: string, callback: () => void) => void;
}

export interface IINAUIAPI {
  loadFile: (path: string) => void;
  postMessage: (message: string) => void;
  onMessage: (callback: (message: any) => void) => void;
}

export interface IINASidebar extends IINAUIAPI {}

export interface IINAOverlay extends IINAUIAPI {
  setClickable: (clickable: boolean) => void;
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
}

export interface IINAStandaloneWindow extends IINAUIAPI {
  show: () => void;
}

export interface IINAUtils {
  ask: (question: string) => boolean;
  prompt: (question: string) => string | null;
  chooseFile: (title: string, options?: any) => string | null;
}

export interface IINAFile {
  read: (path: string) => string;
  write: (path: string, content: string) => void;
  exists: (path: string) => boolean;
}

export interface IINARuntimeDependencies {
  console: IINAConsole;
  core: IINACore;
  preferences: IINAPreferences;
  menu: IINAMenu;
  event: IINAEvent;
  sidebar: IINASidebar;
  overlay: IINAOverlay;
  standaloneWindow: IINAStandaloneWindow;
  utils: IINAUtils;
  file: IINAFile;
}