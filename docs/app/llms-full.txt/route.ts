import { source } from '@/lib/source';
import { getLLMText } from '@/lib/get-llm-text';

export const revalidate = false;

export async function GET() {
  try {
    const scan = source.getPages().map(getLLMText);
    const scanned = await Promise.all(scan);

    return new Response(scanned.join('\n\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Error generating LLM text: ${message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
