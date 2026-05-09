import { App, Modal, Notice, Platform } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import {
  IconWrench,
  IconCheck,
  IconDownload,
  IconExternalLink,
} from '../views/Icons';
import { markSkillInstalledFromRegistry } from '../core/skill-manager';

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

export class SkillBrowserModal extends Modal {
  root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private onChange?: () => void,
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle('Browse skills');
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <SkillBrowserContent
            onClose={() => this.close()}
            onChange={this.onChange}
          />
        </PluginContext.Provider>
      </StrictMode>,
    );
  }

  onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RegistrySkill {
  identifier: string;
  name: string;
  repo: string;
  installs: string;
  url: string;
}

/* ------------------------------------------------------------------ */
/*  Shell helpers                                                      */
/* ------------------------------------------------------------------ */

function getShellProfileScript(shell: string, home: string): string {
  return shell.endsWith('zsh')
    ? `source "${home}/.zprofile" 2>/dev/null; source "${home}/.zshrc" 2>/dev/null;`
    : `source "${home}/.bash_profile" 2>/dev/null; source "${home}/.bashrc" 2>/dev/null;`;
}

function formatWindowsCmdLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteForWindowsCmd).join(' ');
}

function quoteForWindowsCmd(value: string): string {
  if (value === '') return '""';
  if (!/[\s"&<>|^()%!,;=]/.test(value)) return value;
  const escaped = value
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/, '$1$1');
  return `"${escaped}"`;
}

function runSkillsCommand(args: string[], cwd: string, timeout = 30000): Promise<string> {
  const { execFile } = require('child_process') as typeof import('child_process');

  if (Platform.isWin) {
    return new Promise((resolve, reject) => {
      // CVE-2024-27980: Node refuses to spawn .cmd/.bat via execFile without shell:true.
      // Invoke npx.cmd through cmd.exe with a properly-quoted command line.
      const cmdLine = formatWindowsCmdLine('npx.cmd', ['skills', ...args]);
      execFile('cmd.exe', ['/d', '/s', '/c', cmdLine], { timeout, cwd }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve(stdout);
      });
    });
  }

  const home = process.env.HOME ?? '';
  const shell = process.env.SHELL ?? '/bin/zsh';
  const sourceCmd = getShellProfileScript(shell, home);
  const argEnv = Object.fromEntries(
    args.map((arg, index) => [`KNOWLERY_SKILLS_ARG_${index}`, arg]),
  );
  const argRefs = args.map((_, index) => `"$KNOWLERY_SKILLS_ARG_${index}"`).join(' ');

  return new Promise((resolve, reject) => {
    execFile(
      shell,
      ['-c', `${sourceCmd} npx skills ${argRefs}`],
      { timeout, cwd, env: { ...process.env, ...argEnv } },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/* ------------------------------------------------------------------ */
/*  Output parser                                                      */
/* ------------------------------------------------------------------ */

function splitIdentifier(identifier: string): { name: string; repo: string } {
  const atIdx = identifier.indexOf('@');
  if (atIdx > 0) {
    return {
      repo: identifier.substring(0, atIdx),
      name: identifier.substring(atIdx + 1),
    };
  }
  return { repo: '', name: identifier };
}

function parseSearchResults(raw: string): RegistrySkill[] {
  const clean = stripAnsi(raw);
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l);
  const results: RegistrySkill[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\S+@\S+)\s+([\d.]+[KMB]?)\s+installs?$/i);
    if (!match) continue;

    const identifier = match[1];
    const installs = match[2];
    const { name, repo } = splitIdentifier(identifier);

    let url = '';
    if (i + 1 < lines.length) {
      const urlMatch = lines[i + 1].match(/^[└|]\s*(https?:\/\/\S+)/);
      if (urlMatch) {
        url = urlMatch[1];
        i++;
      }
    }

    results.push({ identifier, name, repo, installs, url });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Content component                                                  */
/* ------------------------------------------------------------------ */

function SkillBrowserContent(props: { onClose: () => void; onChange?: () => void }) {
  const plugin = usePlugin();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistrySkill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  if (Platform.isMobile) {
    return (
      <div className="knowlery-skill-browser">
        <p>Skill browsing is not available on mobile.</p>
        <div className="knowlery-skill-browser__actions">
          <button onClick={props.onClose}>Close</button>
        </div>
      </div>
    );
  }

  const vaultPath = (plugin.app.vault.adapter as any).basePath as string;

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const sanitized = trimmed.replace(/[^a-zA-Z0-9\s\-_]/g, '');
    if (!sanitized) {
      setError('Query contains no valid characters. Use letters, numbers, hyphens, and underscores.');
      return;
    }

    setSearching(true);
    setError(null);
    setResults([]);
    setSearched(true);

    try {
      const output = await runSkillsCommand(['find', sanitized], vaultPath);
      const parsed = parseSearchResults(output);
      setResults(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('ERR_MODULE_NOT_FOUND')) {
        setError(
          'skills CLI not found. Install it with: npm install -g skills',
        );
      } else if (msg.includes('No skills found')) {
        setResults([]);
      } else {
        setError(msg);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleInstall = async (skill: RegistrySkill) => {
    const id = skill.identifier;
    const safeId = id.replace(/[^a-zA-Z0-9@/_\-.:]/g, '');
    if (!safeId || safeId !== id) {
      new Notice('Invalid skill identifier.');
      return;
    }

    setInstalling(id);
    try {
      await runSkillsCommand(['add', safeId, '--copy', '--yes'], vaultPath, 60000);
      await markSkillInstalledFromRegistry(plugin.app, skill.name, skill.identifier);
      setInstalled((prev) => new Set(prev).add(id));
      new Notice(`Installed skill: ${skill.name}`);
      props.onChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Install failed: ${msg}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="knowlery-skill-browser">
      <div className="knowlery-skill-browser__search">
        <input
          type="text"
          className="knowlery-skill-browser__input"
          placeholder="Search skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="knowlery-skill-browser__search-btn"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="knowlery-skill-browser__error">{error}</div>
      )}

      {results.length > 0 && (
        <div className="knowlery-skill-browser__results">
          {results.map((r) => {
            const isInstalled = installed.has(r.identifier);
            const isInstalling = installing === r.identifier;

            return (
              <div key={r.identifier} className="knowlery-skill-browser__card">
                <div className="knowlery-skill-browser__card-icon">
                  <IconWrench size={18} />
                </div>

                <div className="knowlery-skill-browser__card-body">
                  <div className="knowlery-skill-browser__card-name">
                    {r.name}
                  </div>
                  <div className="knowlery-skill-browser__card-meta">
                    <span className="knowlery-skill-browser__card-repo">
                      {r.repo}
                    </span>
                    <span className="knowlery-skill-browser__card-installs">
                      <IconDownload size={10} />
                      {r.installs}
                    </span>
                  </div>
                </div>

                <div className="knowlery-skill-browser__card-actions">
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="knowlery-skill-browser__btn-view"
                    >
                      <IconExternalLink size={12} />
                      View
                    </a>
                  )}
                  {isInstalled ? (
                    <span className="knowlery-skill-browser__btn-installed">
                      <IconCheck size={12} />
                      Installed
                    </span>
                  ) : (
                    <button
                      className="knowlery-skill-browser__btn-install"
                      onClick={() => handleInstall(r)}
                      disabled={installing !== null}
                    >
                      {isInstalling ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {searched && !searching && results.length === 0 && !error && (
        <p className="knowlery-skill-browser__hint">
          No results found. Browse available skills at{' '}
          <a href="https://skills.sh" target="_blank" rel="noopener">
            skills.sh
          </a>
        </p>
      )}

      {!searched && (
        <p className="knowlery-skill-browser__hint">
          Search the{' '}
          <a href="https://skills.sh" target="_blank" rel="noopener">
            skills.sh
          </a>{' '}
          registry for third-party skills.
        </p>
      )}
    </div>
  );
}
