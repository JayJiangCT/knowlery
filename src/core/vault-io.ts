import type { App } from 'obsidian';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export async function ensureDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!app.vault.getFolderByPath(normalized)) {
    try {
      await app.vault.createFolder(normalized);
    } catch {
      // Folder may exist on disk but not in vault index (hidden directories)
    }
  }
}

export async function writeFile(app: App, path: string, content: string): Promise<void> {
  const normalized = normalizePath(path);
  const existing = app.vault.getFileByPath(normalized);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    try {
      await app.vault.create(normalized, content);
    } catch {
      // File exists on disk but not in vault index — write via adapter
      await app.vault.adapter.write(normalized, content);
    }
  }
}

export async function copyDirectory(
  app: App,
  srcDir: string,
  destDir: string,
): Promise<void> {
  const adapter = app.vault.adapter;
  const normalizedSrc = normalizePath(srcDir);
  const normalizedDest = normalizePath(destDir);

  if (!(await adapter.exists(normalizedSrc))) return;

  await ensureDir(app, normalizedDest);

  const listing = await adapter.list(normalizedSrc);

  for (const filePath of listing.files) {
    const content = await adapter.read(filePath);
    const relativePath = filePath.slice(normalizedSrc.length + 1);
    await writeFile(app, `${normalizedDest}/${relativePath}`, content);
  }

  for (const folderPath of listing.folders) {
    const relativePath = folderPath.slice(normalizedSrc.length + 1);
    await copyDirectory(app, folderPath, `${normalizedDest}/${relativePath}`);
  }
}
