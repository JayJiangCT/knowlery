import type { BundleManifest } from '../../types';
import type { BundleFile } from './shared';
import { KNOWLERY_BUNDLE_SCHEMA_VERSION, OKF_VERSION } from './shared';
import { sha256 } from './hash';

export function buildBundleManifest(input: {
  id: string;
  title: string;
  version: string;
  creator: { name: string; url: string };
  releasedAt: string;
  license: string;
  knowleryVersion: string;
  conceptCount: number;
  files: BundleFile[];
}): BundleManifest {
  return {
    schemaVersion: KNOWLERY_BUNDLE_SCHEMA_VERSION,
    okfVersion: OKF_VERSION,
    id: input.id,
    title: input.title,
    version: input.version,
    creator: input.creator,
    releasedAt: input.releasedAt,
    entrypoint: 'index.md',
    contentHash: contentHash(input.files),
    license: input.license,
    knowleryVersion: input.knowleryVersion,
    conceptCount: input.conceptCount,
  };
}

export function contentHash(files: BundleFile[]): string {
  const knowledgeFiles = files
    .filter((file) => file.kind === 'concept' || file.kind === 'source')
    .map((file) => `${file.path}\n${file.content}`)
    .sort()
    .join('\n');
  return sha256(knowledgeFiles);
}
