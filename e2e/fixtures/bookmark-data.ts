/** Test data factories for Playwright E2E tests */

export interface TestBookmark {
  id: string;
  title: string;
  timestamp: number;
  filepath: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

let idCounter = 0;

/** Create a single test bookmark with sensible defaults */
export function makeBookmark(overrides: Partial<TestBookmark> = {}): TestBookmark {
  const id = overrides.id ?? `test-${++idCounter}`;
  const now = new Date().toISOString();
  return {
    id,
    title: `Bookmark ${id}`,
    timestamp: 120,
    filepath: '/test/video.mp4',
    description: `Description for ${id}`,
    createdAt: now,
    updatedAt: now,
    tags: [],
    ...overrides,
  };
}

/** Create N bookmarks for a given file */
export function makeBookmarksForFile(
  filepath: string,
  count: number,
  tagSets?: string[][],
): TestBookmark[] {
  return Array.from({ length: count }, (_, i) =>
    makeBookmark({
      filepath,
      title: `${filepath.split('/').pop()} - Scene ${i + 1}`,
      timestamp: (i + 1) * 60,
      tags: tagSets?.[i] ?? [],
    }),
  );
}

/** Reset the ID counter (call in beforeEach) */
export function resetIdCounter(): void {
  idCounter = 0;
}

/** Standard test fixtures */
export const TEST_FILE_A = '/movies/test-a.mp4';
export const TEST_FILE_B = '/movies/test-b.mkv';

export const SAMPLE_BOOKMARKS: TestBookmark[] = [
  makeBookmark({
    id: 'bk-1',
    title: 'Opening Scene',
    timestamp: 0,
    filepath: TEST_FILE_A,
    tags: ['important', 'scene'],
  }),
  makeBookmark({
    id: 'bk-2',
    title: 'Plot Twist',
    timestamp: 1800,
    filepath: TEST_FILE_A,
    tags: ['important'],
    description: 'The big reveal happens here',
  }),
  makeBookmark({
    id: 'bk-3',
    title: 'Credits',
    timestamp: 5400,
    filepath: TEST_FILE_A,
    tags: ['scene'],
  }),
  makeBookmark({
    id: 'bk-4',
    title: 'Intro',
    timestamp: 0,
    filepath: TEST_FILE_B,
    tags: ['work'],
  }),
  makeBookmark({
    id: 'bk-5',
    title: 'Key Moment',
    timestamp: 900,
    filepath: TEST_FILE_B,
    tags: ['work', 'important'],
  }),
];
