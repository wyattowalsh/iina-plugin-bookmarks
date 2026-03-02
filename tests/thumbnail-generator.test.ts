import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThumbnailGenerator } from '../src/thumbnail-generator';
import type { BookmarkData, IINARuntimeDependencies } from '../src/types';
import { createMockDeps } from './helpers/mock-deps';

describe('ThumbnailGenerator', () => {
  let deps: IINARuntimeDependencies;
  let generator: ThumbnailGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    generator = new ThumbnailGenerator(deps);
  });

  it('sanitizes thumbnail output filename from bookmark id', () => {
    const bookmark: BookmarkData = {
      id: '../unsafe:id?name',
      title: 'Test',
      timestamp: 12,
      filepath: '/test/video.mp4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    };

    const outPath = generator.generate(bookmark);

    expect(outPath).toMatch(/^@data\/thumbs\/[A-Za-z0-9._-]+\.jpg$/);
    expect(outPath).not.toContain('..');
    expect(outPath).not.toContain('?');
    expect(deps.utils.exec).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining([
        '-y',
        expect.stringMatching(/^@data\/thumbs\/[A-Za-z0-9._-]+\.jpg$/),
      ]),
    );
  });
});
