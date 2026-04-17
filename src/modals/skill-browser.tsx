import { App, Modal, Platform } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

export class SkillBrowserModal extends Modal {
  root: Root | null = null;

  constructor(app: App, private plugin: KnowleryPlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle('Browse skills');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <SkillBrowserContent onClose={() => this.close()} />
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
/*  Content component                                                  */
/* ------------------------------------------------------------------ */

interface SearchResult {
  name: string;
  description: string;
}

function SkillBrowserContent(props: { onClose: () => void }) {
  const plugin = usePlugin();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

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

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setResults([]);
    setSearched(true);

    try {
      const { exec } = await import('child_process');
      const nodePath = plugin.settings.nodePath || 'node';

      const output = await new Promise<string>((resolve, reject) => {
        exec(
          `"${nodePath}" -e "const{execSync}=require('child_process');process.stdout.write(execSync('npx skills search ${query.replace(/"/g, '\\"')}',{encoding:'utf-8'}))"`,
          { timeout: 30000 },
          (err, stdout, stderr) => {
            if (err) {
              reject(new Error(stderr || err.message));
              return;
            }
            resolve(stdout);
          },
        );
      });

      const parsed = parseSearchResults(output);
      setResults(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSearching(false);
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
          placeholder="Search skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="mod-cta"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="knowlery-skill-browser__error">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="knowlery-skill-browser__results">
          {results.map((r, i) => (
            <div key={i} className="knowlery-skill-browser__result">
              <strong>{r.name}</strong>
              {r.description && <span>{r.description}</span>}
            </div>
          ))}
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseSearchResults(output: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = output.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try to parse "name - description" format
    const dashIndex = trimmed.indexOf(' - ');
    if (dashIndex > 0) {
      results.push({
        name: trimmed.substring(0, dashIndex).trim(),
        description: trimmed.substring(dashIndex + 3).trim(),
      });
    } else {
      results.push({ name: trimmed, description: '' });
    }
  }

  return results;
}
