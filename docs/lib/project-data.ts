// Import JSON files (resolveJsonModule: true in tsconfig)
import packageJson from '../../package.json';
import infoJson from '../../Info.json';

/** Strip ^, ~, >= prefixes from version string, e.g. "^5.9.3" -> "5.9.3" */
export function cleanVersion(v: string): string {
  return v.replace(/^[\^~>=<]+/, '');
}

type RootPackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
  packageManager?: string;
  coveragePolicy?: {
    lines?: number;
    statements?: number;
    branches?: number;
    functions?: number;
  };
};

const rootPackage = packageJson as RootPackageManifest;

export function getDependencyVersion(name: string): string {
  return rootPackage.dependencies?.[name] ?? rootPackage.devDependencies?.[name] ?? 'unknown';
}

const defaultCoveragePolicy = { lines: 33, statements: 32, branches: 24, functions: 23 };

export const coverageThresholds = {
  lines: rootPackage.coveragePolicy?.lines ?? defaultCoveragePolicy.lines,
  statements: rootPackage.coveragePolicy?.statements ?? defaultCoveragePolicy.statements,
  branches: rootPackage.coveragePolicy?.branches ?? defaultCoveragePolicy.branches,
  functions: rootPackage.coveragePolicy?.functions ?? defaultCoveragePolicy.functions,
};
export const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_BASE_URL || 'https://iina-plugin-bookmarks.w4w.dev';

// Tech stack versions
const techStack = {
  typescript: getDependencyVersion('typescript'),
  eslint: getDependencyVersion('eslint'),
  prettier: getDependencyVersion('prettier'),
  husky: getDependencyVersion('husky'),
  vitest: getDependencyVersion('vitest'),
  parcel: getDependencyVersion('parcel'),
  react: getDependencyVersion('react'),
};

// Project metadata
export const project = {
  version: infoJson.version,
  ghRepo: infoJson.ghRepo,
  name: infoJson.name,
  description: infoJson.description,
  techStack,
  nodeEngine: rootPackage.engines?.node ?? 'unknown',
  packageManager: rootPackage.packageManager ?? 'unknown',
};
