import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center text-center px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="mb-4 text-4xl font-bold">IINA Plugin Bookmarks</h1>
          <p className="text-fd-muted-foreground text-lg">
            Advanced bookmark management for IINA media player with intelligent fallback detection and seamless UI integration.
          </p>
        </div>

        <Card className="text-left">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Documentation Site 
              <Badge variant="secondary">Live</Badge>
            </CardTitle>
            <CardDescription>
              Comprehensive documentation built with Fumadocs, shadcn/ui, and Tailwind CSS 4
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/docs">
                  View Documentation
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="https://github.com/wyattowalsh/iina-plugin-bookmarks" target="_blank">
                  GitHub Repository
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-center gap-2">
          <Badge>React 19</Badge>
          <Badge>Tailwind CSS 4</Badge>
          <Badge>shadcn/ui</Badge>
          <Badge>Fumadocs</Badge>
          <Badge>TypeScript</Badge>
        </div>
      </div>
    </main>
  );
}
