import { source } from '@/lib/source';
import { BASE_URL } from '@/lib/project-data';

export const revalidate = false;

export function GET() {
  try {
    const pages = source.getPages();

    const lines = [
      '# IINA Plugin Bookmarks Documentation',
      '',
      `> ${BASE_URL}`,
      '',
      '## Pages',
      '',
      ...pages.map((page) => `- [${page.data.title}](${BASE_URL}${page.url})`),
    ];

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating LLM index: ${message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
