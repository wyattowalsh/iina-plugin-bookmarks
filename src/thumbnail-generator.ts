import { errorMessage, type BookmarkData, type IINARuntimeDependencies } from './types';

export function toSafeThumbnailStem(bookmarkId: string): string {
  const sanitized = bookmarkId
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+/, '')
    .slice(0, 80);
  return sanitized || 'bookmark';
}

export class ThumbnailGenerator {
  constructor(private deps: IINARuntimeDependencies) {}

  generate(bookmark: BookmarkData): string | null {
    if (!this.deps.utils.exec) {
      this.deps.console.warn('utils.exec unavailable — cannot generate thumbnail');
      return null;
    }

    const outPath = `@data/thumbs/${toSafeThumbnailStem(bookmark.id)}.jpg`;

    try {
      // Check if source file exists
      if (!this.deps.file.exists(bookmark.filepath)) {
        this.deps.console.warn(`Source file not found: ${bookmark.filepath}`);
        return null;
      }

      this.deps.utils.exec('ffmpeg', [
        '-ss',
        String(bookmark.timestamp),
        '-i',
        bookmark.filepath,
        '-vframes',
        '1',
        '-vf',
        'scale=240:-1',
        '-q:v',
        '3',
        '-y',
        outPath,
      ]);

      this.deps.console.log(`Thumbnail generated for bookmark ${bookmark.id}`);
      return outPath;
    } catch (error) {
      this.deps.console.warn(`Thumbnail generation failed: ${errorMessage(error)}`);
      return null;
    }
  }
}
