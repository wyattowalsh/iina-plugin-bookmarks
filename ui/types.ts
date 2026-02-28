// Re-export shared types from the canonical source
export type {
  BookmarkData,
  BookmarkDefaults,
  BookmarkCollection,
  SmartCollection,
  SmartCollectionFilters,
  BookmarkColor,
  BookmarkUpdatableFields,
  PlaybackStatus,
  ChapterInfo,
  ImportResult,
} from '../src/types';

export interface AppWindow extends Window {
  iina?: {
    postMessage: (type: string, data?: any) => void;
    onMessage: (event: string, callback: (data: any) => void) => void;
  };
}
