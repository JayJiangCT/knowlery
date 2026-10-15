import { createHash } from 'node:crypto';

/** Deterministic PRNG (mulberry32): every sample, shuffle and bootstrap is reproducible from its seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives an independent stream seed from a base seed and a label. */
export function deriveSeed(seed: number, label: string): number {
  return createHash('sha256').update(`${seed}:${label}`).digest().readUInt32BE(0);
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sha256(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Sheet ids carry no order information (sequential ids would reveal which entries a
 * later pool step added). Derived from seed + path; lengthened on collision.
 */
export function assignIds(paths: readonly string[], seed: number, taken: ReadonlySet<string> = new Set()): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set(taken);
  for (const path of paths) {
    const digest = sha256(`${seed}:${path}`);
    let length = 6;
    let id = `n${digest.slice(0, length)}`;
    while (used.has(id)) {
      length += 1;
      id = `n${digest.slice(0, length)}`;
    }
    used.add(id);
    ids.set(path, id);
  }
  return ids;
}
