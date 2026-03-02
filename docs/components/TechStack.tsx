import { project, cleanVersion } from '@/lib/project-data';

export function TechStack() {
  const technologies = [
    { name: 'TypeScript', version: cleanVersion(project.techStack.typescript) },
    { name: 'ESLint', version: cleanVersion(project.techStack.eslint) },
    { name: 'Prettier', version: cleanVersion(project.techStack.prettier) },
    { name: 'Vitest', version: cleanVersion(project.techStack.vitest) },
    { name: 'Parcel', version: cleanVersion(project.techStack.parcel) },
    { name: 'React', version: cleanVersion(project.techStack.react) },
    { name: 'Husky', version: cleanVersion(project.techStack.husky) },
  ];

  return (
    <table>
      <thead>
        <tr>
          <th>Technology</th>
          <th>Version</th>
        </tr>
      </thead>
      <tbody>
        {technologies.map((tech) => (
          <tr key={tech.name}>
            <td>{tech.name}</td>
            <td>{tech.version}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
