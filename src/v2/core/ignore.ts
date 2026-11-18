import { KnowleryError } from './errors';

export function validateIgnore(entry: string): void {
  if (entry.startsWith('/') || entry.includes('\\') || entry.split('/').includes('..')) {
    throw new KnowleryError('invalid_config', `Invalid ignore entry: ${entry}`, 'Use root-relative ignore entries with / separators and no .. segments.');
  }
}

export function createIgnoreMatcher(entries: string[]): (path: string) => boolean {
  const matchers = entries.map((entry) => {
    validateIgnore(entry);
    if (!entry.includes('*')) {
      const exact = entry.replace(/\/+$/, '');
      return (path: string) => path === exact || path.startsWith(`${exact}/`);
    }
    let pattern = '';
    for (let i = 0; i < entry.length; i++) {
      if (entry[i] === '*') {
        if (entry[i + 1] === '*') {
          pattern += '.*';
          i++;
        } else pattern += '[^/]*';
      } else pattern += entry[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const regex = new RegExp(`^${pattern}$`);
    return (path: string) => regex.test(entry.includes('/') ? path : path.slice(path.lastIndexOf('/') + 1));
  });
  return (path) => matchers.some((matches) => matches(path));
}
