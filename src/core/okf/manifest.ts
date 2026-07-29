import type { BundleAttachmentRecord, BundleManifest } from '../../types';
import type { BundleFile } from './shared';
import { OKF_VERSION, isTextBundleFile } from './shared';
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
  attachments?: BundleAttachmentRecord[];
}): BundleManifest {
  const base = {
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
  // The conditional schema bump (spec 1.3.1 f1, §4.5): attachment-bearing
  // bundles declare version 2, which pre-1.3.1 readers refuse whole at
  // their manifest gate — the alternative was silent binary corruption.
  // Attachment-free bundles stay version 1, byte-identical to before.
  if (input.attachments && input.attachments.length > 0) {
    return { schemaVersion: 2, attachments: input.attachments, ...base };
  }
  return { schemaVersion: 1, ...base };
}

export function contentHash(files: BundleFile[]): string {
  const knowledgeFiles = files
    .filter((file) => (file.kind === 'concept' || file.kind === 'source') && isTextBundleFile(file))
    .map((file) => `${file.path}\n${file.content!}`)
    .sort()
    .join('\n');
  return sha256(knowledgeFiles);
}
