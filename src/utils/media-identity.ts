/** Treat a stored bookmark path and a live IINA URL as the same file when they are. */
export function sameMedia(
  left: string | undefined | null,
  right: string | undefined | null,
): boolean {
  const stored = canonicalMedia(left);
  const live = canonicalMedia(right);
  return stored.length > 0 && stored === live;
}

function canonicalMedia(value: string | undefined | null): string {
  if (!value) return '';
  let text = value.trim();
  if (text.includes('%')) {
    try {
      text = decodeURIComponent(text);
    } catch {
      // Keep the original text when it is not valid percent-encoding.
    }
  }
  const fileUrl = text.match(/^file:\/\/(?:localhost)?(\/.*)$/i);
  if (fileUrl) return fileUrl[1];
  return text;
}
