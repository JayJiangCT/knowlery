import { KnowleryError } from '../errors';
import type { Unit } from '../extract/types';

export const LOCATOR_PAGE_CAP = 12288;
export const OUTLINE_PAGE_CAP = 4096;

export interface Segment {
  text: string;
  kind: 'row' | 'other';
}

export interface PageResult {
  text: string;
  offset: number;
  bytes: number;
  total_bytes: number;
  partial: boolean;
  more: boolean;
}

export function pieceSegments(pieces: Unit[]): Segment[] {
  return pieces.map((piece, index) => {
    let separator = '';
    if (index + 1 < pieces.length) {
      const next = pieces[index + 1];
      const adjacent = (piece.kind === 'row' && next.kind === 'row') ||
        (piece.kind === 'lines' && next.kind === 'lines' && next.start === piece.end + 1);
      separator = adjacent ? '\n' : '\n\n';
    }
    return {
      text: `${piece.text}${separator}`,
      kind: piece.kind === 'row' ? 'row' : 'other',
    };
  });
}

export function outlineSegments(lines: string[]): Segment[] {
  return lines.map((line) => ({ text: `${line}\n`, kind: 'other' }));
}

function invalidOffset(message: string): never {
  throw new KnowleryError('invalid_selector', message, 'Use a byte offset on a character boundary within the text.');
}

function isCharBoundary(buffer: Buffer, index: number): boolean {
  if (index === 0 || index === buffer.length) return true;
  if (index < 0 || index > buffer.length) return false;
  return (buffer[index] & 0xc0) !== 0x80;
}

function lastCharBoundary(buffer: Buffer, maxBytes: number): number {
  let end = Math.min(maxBytes, buffer.length);
  while (end > 0 && !isCharBoundary(buffer, end)) end--;
  return end;
}

function slicePartialSegment(buffer: Buffer, start: number, cap: number, kind: Segment['kind']): number {
  const limit = Math.min(buffer.length, start + cap);
  if (limit >= buffer.length) return buffer.length;
  if (kind === 'row') {
    const tab = buffer.lastIndexOf(0x09, limit - 1);
    if (tab >= start) return tab + 1;
  }
  const end = lastCharBoundary(buffer, limit);
  if (end <= start) invalidOffset('Page cap is too small to fit a single character.');
  return end;
}

export function paginateSegments(segments: Segment[], offset: number, cap: number): PageResult {
  if (!Number.isSafeInteger(offset) || offset < 0) invalidOffset(`Invalid offset: ${offset}`);
  const encoded = segments.map((segment) => ({
    buffer: Buffer.from(segment.text, 'utf8'),
    kind: segment.kind,
  }));
  const totalBytes = encoded.reduce((sum, item) => sum + item.buffer.length, 0);

  if (totalBytes === 0) {
    if (offset !== 0) invalidOffset(`Offset ${offset} is out of range for empty text.`);
    return { text: '', offset: 0, bytes: 0, total_bytes: 0, partial: false, more: false };
  }
  if (offset >= totalBytes) invalidOffset(`Offset ${offset} exceeds text size ${totalBytes}.`);

  let segmentIndex = 0;
  let segmentStart = 0;
  while (segmentIndex < encoded.length && segmentStart + encoded[segmentIndex].buffer.length <= offset) {
    segmentStart += encoded[segmentIndex].buffer.length;
    segmentIndex++;
  }
  const first = encoded[segmentIndex];
  const insideOffset = offset - segmentStart;
  if (!isCharBoundary(first.buffer, insideOffset)) {
    invalidOffset(`Offset ${offset} falls inside a multi-byte UTF-8 character.`);
  }

  // Offset inside a segment continues that segment (potentially partially or to its end).
  if (insideOffset > 0) {
    const remaining = first.buffer.length - insideOffset;
    if (remaining > cap) {
      const end = slicePartialSegment(first.buffer, insideOffset, cap, first.kind);
      const bytes = end - insideOffset;
      return {
        text: first.buffer.subarray(insideOffset, end).toString('utf8'),
        offset,
        bytes,
        total_bytes: totalBytes,
        partial: true,
        more: offset + bytes < totalBytes,
      };
    }
    const chunks: Buffer[] = [first.buffer.subarray(insideOffset)];
    let bytes = remaining;
    for (let i = segmentIndex + 1; i < encoded.length; i++) {
      if (bytes + encoded[i].buffer.length > cap) break;
      chunks.push(encoded[i].buffer);
      bytes += encoded[i].buffer.length;
    }
    return {
      text: Buffer.concat(chunks).toString('utf8'),
      offset,
      bytes,
      total_bytes: totalBytes,
      partial: true,
      more: offset + bytes < totalBytes,
    };
  }

  // Offset is at the start of a segment.
  if (first.buffer.length > cap) {
    const end = slicePartialSegment(first.buffer, 0, cap, first.kind);
    return {
      text: first.buffer.subarray(0, end).toString('utf8'),
      offset,
      bytes: end,
      total_bytes: totalBytes,
      partial: true,
      more: offset + end < totalBytes,
    };
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for (let i = segmentIndex; i < encoded.length; i++) {
    if (bytes + encoded[i].buffer.length > cap) break;
    chunks.push(encoded[i].buffer);
    bytes += encoded[i].buffer.length;
  }
  return {
    text: Buffer.concat(chunks).toString('utf8'),
    offset,
    bytes,
    total_bytes: totalBytes,
    partial: false,
    more: offset + bytes < totalBytes,
  };
}
