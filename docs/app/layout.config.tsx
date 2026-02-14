import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { GithubIcon } from 'lucide-react';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image
          src="/assets/icon.png"
          alt="IINA Plugin Bookmarks"
          width={24}
          height={24}
          className="rounded"
        />
        IINA Plugin Bookmarks
      </>
    ),
  },
  // see https://fumadocs.dev/docs/ui/navigation/links
  links: [
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
    },
    {
      icon: <GithubIcon />,
      text: 'GitHub',
      url: 'https://github.com/wyattowalsh/iina-plugin-bookmarks',
      external: true,
    },
  ],
};
