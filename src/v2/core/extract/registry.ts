import { csv } from './csv';
import { markdown } from './markdown';
import { txt } from './txt';
import type { Registry } from './types';

export const registry: Registry = { markdown, txt, csv };
