import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookmarkIcon,
  CloudIcon,
  FileTextIcon,
  LayoutGridIcon,
  ArrowRightIcon,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">IINA Plugin Bookmarks</h1>
          <p className="text-fd-muted-foreground text-xl max-w-2xl mx-auto">
            Advanced bookmark management for IINA media player with intelligent fallback detection
            and seamless UI integration.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Button asChild size="lg">
              <Link href="/docs">
                Get Started
                <ArrowRightIcon className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link
                href="https://github.com/wyattowalsh/iina-plugin-bookmarks"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </Link>
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookmarkIcon className="size-5" />
                Smart Bookmark Management
              </CardTitle>
              <CardDescription>
                Create, organize, and jump to bookmarks with millisecond precision. Automatic
                metadata detection and tag-based filtering.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudIcon className="size-5" />
                Cloud Synchronization
              </CardTitle>
              <CardDescription>
                Sync your bookmarks across devices with built-in conflict resolution and offline
                support. Works with any cloud storage provider.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGridIcon className="size-5" />
                Multiple UI Interfaces
              </CardTitle>
              <CardDescription>
                Access bookmarks via sidebar, overlay, or dedicated window. Dark mode support and
                responsive design built-in.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="size-5" />
                Import & Export
              </CardTitle>
              <CardDescription>
                Full JSON import/export with validation and error recovery. Preserve all metadata
                including custom tags and descriptions.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Start Section */}
        <div className="bg-fd-muted/30 dark:bg-fd-muted/10 rounded-lg p-8 border border-fd-border">
          <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5">
                1
              </Badge>
              <div>
                <p className="font-medium">Install the plugin</p>
                <p className="text-sm text-fd-muted-foreground">
                  Download from GitHub releases or build from source
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5">
                2
              </Badge>
              <div>
                <p className="font-medium">Enable in IINA</p>
                <p className="text-sm text-fd-muted-foreground">
                  Open IINA preferences and activate the Bookmarks plugin
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5">
                3
              </Badge>
              <div>
                <p className="font-medium">Start bookmarking</p>
                <p className="text-sm text-fd-muted-foreground">
                  Access the sidebar to create your first bookmark
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/docs">View Full Documentation</Link>
            </Button>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="text-center space-y-4">
          <p className="text-sm text-fd-muted-foreground font-medium">
            Built with modern web technologies
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">React 19</Badge>
            <Badge variant="secondary">Tailwind CSS 4</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
            <Badge variant="secondary">Fumadocs</Badge>
            <Badge variant="secondary">Vitest</Badge>
          </div>
        </div>
      </div>
    </main>
  );
}
