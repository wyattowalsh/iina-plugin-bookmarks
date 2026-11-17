import { describe, expect, it } from 'vitest';
import { BookmarkManager } from '../src/bookmark-manager';
import { sameMedia } from '../src/utils/media-identity';
import { createMockDeps } from './helpers/mock-deps';

describe('sameMedia', () => {
  it('matches a stored path with the file URL IINA reports', () => {
    expect(sameMedia('/Movies/My Video.mp4', 'file:///Movies/My Video.mp4')).toBe(true);
    expect(sameMedia('/Movies/a.mp4', 'file://localhost/Movies/a.mp4')).toBe(true);
    expect(sameMedia('file:///My%20Video.mp4', 'file:///My Video.mp4')).toBe(true);
  });

  it('does not match a local path to a network URL with the same filename', () => {
    expect(sameMedia('/videos/a.mp4', 'https://cdn.example/a.mp4')).toBe(false);
  });
});

describe('legacy bookmark paths', () => {
  it('seeks a path bookmark when the live file is the same file URL', async () => {
    const deps = createMockDeps();
    deps.preferences.get = () =>
      JSON.stringify([
        {
          id: 'legacy-1',
          title: 'Saved',
          timestamp: 40,
          filepath: '/test/video.mp4',
          description: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          tags: [],
        },
      ]);
    deps.core.status.url = 'file:///test/video.mp4';
    deps.core.status.position = 10;
    const manager = new BookmarkManager(deps);

    manager.jumpToBookmark('legacy-1');

    expect(deps.core.seekTo).toHaveBeenCalledWith(40);
    expect(deps.core.open).not.toHaveBeenCalled();
    expect(deps.preferences.set).not.toHaveBeenCalledWith('bookmarks', expect.any(String));
  });
});
