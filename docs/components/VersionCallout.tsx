import { Callout } from 'fumadocs-ui/components/callout';
import { project } from '@/lib/project-data';

export function VersionCallout() {
  return <Callout title={`Latest Release: Version ${project.version}`} type="info" />;
}
