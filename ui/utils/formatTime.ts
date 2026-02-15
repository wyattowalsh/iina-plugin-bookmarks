export { formatTime } from '../../src/utils/formatTime';

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}
