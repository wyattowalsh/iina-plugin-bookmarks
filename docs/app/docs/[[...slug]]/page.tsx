import { source } from '@/lib/source';
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/mdx-components';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const baseUrl = 'https://iina-plugin-bookmarks.w4w.dev';

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.data.title,
    description: page.data.description || '',
    author: {
      '@type': 'Person',
      name: 'Wyatt Walsh',
      url: 'https://github.com/wyattowalsh',
    },
    url: `${baseUrl}${page.url}`,
    publisher: {
      '@type': 'Organization',
      name: 'IINA Plugin Bookmarks',
      url: baseUrl,
    },
    inLanguage: 'en-US',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <DocsPage
        toc={page.data.toc}
        full={page.data.full}
        editOnGithub={{
          owner: 'wyattowalsh',
          repo: 'iina-plugin-bookmarks',
          sha: 'main',
          path: `docs/content/docs/${params.slug?.join('/') || 'index'}.mdx`,
        }}
      >
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDXContent
            components={getMDXComponents({
              // this allows you to link to other pages with relative file paths
              a: createRelativeLink(source, page),
            })}
          />
        </DocsBody>
      </DocsPage>
    </>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const baseUrl = 'https://iina-plugin-bookmarks.w4w.dev';
  const pageUrl = `${baseUrl}${page.url}`;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: 'article',
      title: page.data.title,
      description: page.data.description || '',
      url: pageUrl,
      siteName: 'IINA Plugin Bookmarks Documentation',
    },
    twitter: {
      card: 'summary',
      title: page.data.title,
      description: page.data.description || '',
    },
  };
}
