import { createHash } from 'crypto';

export function sha256(input: string): string {
  return `sha256-${createHash('sha256').update(input).digest('hex')}`;
}
