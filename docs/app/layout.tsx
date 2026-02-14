import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | IINA Plugin Bookmarks',
    default: 'IINA Plugin Bookmarks Documentation',
  },
  description:
    'Complete documentation for IINA Plugin Bookmarks - Advanced bookmark management for IINA media player with cloud sync, tagging, and search.',
  keywords: [
    'IINA',
    'plugin',
    'bookmarks',
    'media player',
    'macOS',
    'video player',
    'cloud sync',
    'bookmark manager',
    'JavaScript',
    'TypeScript',
  ],
  authors: [{ name: 'Wyatt Walsh', url: 'https://github.com/wyattowalsh' }],
  creator: 'Wyatt Walsh',
  publisher: 'IINA Plugin Bookmarks',
  applicationName: 'IINA Plugin Bookmarks',
  metadataBase: new URL('https://iina-plugin-bookmarks.w4w.dev'),
  alternates: {
    canonical: '/',
  },
  category: 'Technology',
  icons: {
    icon: [
      { url: '/assets/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/favicon/favicon.ico' },
    ],
    apple: [{ url: '/assets/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      { url: '/assets/favicon/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/favicon/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/assets/favicon/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'IINA Plugin Bookmarks Documentation',
    title: 'IINA Plugin Bookmarks Documentation',
    description:
      'Comprehensive documentation for the IINA Plugin Bookmarks - A smart bookmark management system for the IINA media player.',
    images: [
      {
        url: '/assets/icon.png',
        width: 1200,
        height: 630,
        alt: 'IINA Plugin Bookmarks',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IINA Plugin Bookmarks Documentation',
    description:
      'Comprehensive documentation for the IINA Plugin Bookmarks - A smart bookmark management system for the IINA media player.',
    images: ['/assets/icon.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:outline-2 focus:outline-ring"
        >
          Skip to main content
        </a>
        <RootProvider>
          <div id="main-content">{children}</div>
        </RootProvider>
      </body>
    </html>
  );
}
