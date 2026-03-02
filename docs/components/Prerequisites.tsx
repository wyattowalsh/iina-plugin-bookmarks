import { project } from '@/lib/project-data';

export function Prerequisites() {
  const pnpmVersion = project.packageManager?.includes('@')
    ? project.packageManager.split('@')[1]
    : project.packageManager || 'latest';

  return (
    <div className="my-4">
      <h3>Prerequisites</h3>
      <ul>
        <li>
          <strong>Node.js:</strong> {project.nodeEngine}
        </li>
        <li>
          <strong>pnpm:</strong> {pnpmVersion}
        </li>
      </ul>
    </div>
  );
}
