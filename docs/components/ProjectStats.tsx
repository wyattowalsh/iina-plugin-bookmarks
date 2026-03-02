import { project, coverageThresholds } from '@/lib/project-data';

export function ProjectStats() {
  const keys = Object.keys(coverageThresholds);
  const avgCoverage =
    keys.length > 0
      ? Math.round(Object.values(coverageThresholds).reduce((sum, v) => sum + v, 0) / keys.length)
      : 0;

  const stats = [
    { label: 'Version', value: project.version },
    { label: 'Test Coverage', value: `${avgCoverage}%` },
    { label: 'License', value: 'MIT' },
    { label: 'Language', value: 'TypeScript' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 my-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-fd-border p-4">
          <div className="text-sm opacity-70">{stat.label}</div>
          <div className="text-xl font-bold">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
