import { readdir } from 'node:fs/promises';
import { isMissing } from './paths';

export const ALWAYS_SKIPPED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '__pycache__',
]);

export const PROJECT_OUTPUT_DIRS: ReadonlySet<string> = new Set([
  'dist',
  'build',
  'target',
  'outputs',
  'coverage',
  'vendor',
]);

export const PROJECT_MARKERS: ReadonlySet<string> = new Set([
  'package.json',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'go.mod',
  'composer.json',
  'Gemfile',
  'mix.exs',
  'CMakeLists.txt',
  'Makefile',
]);

export async function hasProjectMarker(dirPath: string): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
  for (const entry of entries) {
    if (PROJECT_MARKERS.has(entry.name) && !entry.isDirectory()) {
      return true;
    }
  }
  return false;
}
