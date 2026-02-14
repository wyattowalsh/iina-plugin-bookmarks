import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

// Extended frontmatter schema with custom fields for IINA Plugin Bookmarks
const customFrontmatterSchema = frontmatterSchema.extend({
  // SEO and metadata
  keywords: z.array(z.string()).optional(),
  author: z.string().optional(),
  lastUpdated: z.string().datetime().optional(),

  // Content organization
  category: z.enum(['guide', 'reference', 'tutorial', 'example', 'api']).optional(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),

  // Feature flags
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),

  // Related content
  relatedDocs: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
});

export const docs = defineDocs({
  docs: {
    schema: customFrontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
