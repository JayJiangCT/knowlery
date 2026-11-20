import { csv } from './csv';
import { docx } from './docx';
import { markdown } from './markdown';
import { pdf } from './pdf';
import { txt } from './txt';
import type { Registry } from './types';
import { xlsx } from './xlsx';

export const registry: Registry = { markdown, txt, csv, docx, xlsx, pdf };
