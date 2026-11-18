import type { Format } from '../inventory';

export type Unit = { i: number; text: string } & (
  | { kind: 'heading'; level: number; path: string }
  | { kind: 'block'; path: string; page?: never }
  | { kind: 'block'; page: number; path?: never }
  | { kind: 'lines'; start: number; end: number }
  | { kind: 'row'; row: number; sheet?: string; col?: number }
);
export type CachedState = 'ok' | 'partial' | 'unreadable';
export type ExtractionState = CachedState | 'too_large' | 'unavailable';
export interface Problem { code: string; detail: string; [key: string]: unknown }
export interface Extracted {
  state: CachedState;
  meta: Record<string, unknown>;
  problems: Problem[];
  units: Unit[];
}
export interface Header {
  v: 1;
  extractor: string;
  sha256: string;
  format: Format;
  state: CachedState;
  units: number;
  bytes: number;
  meta: Record<string, unknown>;
  problems: Problem[];
}
export interface Extraction {
  sha256: string | null;
  state: ExtractionState;
  header: Header | null;
  units: Unit[];
  warnings: string[];
  cached: boolean;
}
export interface Extractor { id: string; extract(bytes: Uint8Array): Extracted | Promise<Extracted> }
export type Registry = Partial<Record<Format, Extractor>>;
export const unreadableEncoding = (): Extracted => ({ state: 'unreadable', meta: {}, problems: [{ code: 'encoding', detail: 'Source is not valid UTF-8.' }], units: [] });
