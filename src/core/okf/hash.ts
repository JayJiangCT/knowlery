import { createHash } from 'crypto';

export function sha256(input: string): string {
  return `sha256-${createHash('sha256').update(input).digest('hex')}`;
}

/** Byte-lane twin of sha256 — attachment integrity hashes bytes, never a decode. */
export function sha256Bytes(data: Uint8Array): string {
  return `sha256-${createHash('sha256').update(data).digest('hex')}`;
}
