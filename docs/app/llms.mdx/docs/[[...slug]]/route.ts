import { getLLMText } from '@/lib/get-llm-text';
import { source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  try {
    const { slug } = await params;
    const page = source.getPage(slug);
    if (!page) notFound();

    return new Response(await getLLMText(page), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating LLM markdown: ${message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

export function generateStaticParams() {
  return source.generateParams();
}
