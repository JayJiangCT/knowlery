import type { App } from 'obsidian';
import type {
  ActivityRecord,
  ActivityThemeSummary,
  CounterSummary,
} from '../types';
import { buildCounterSummary } from './activity-model';

export const REPORT_DIR = '.knowlery/reports';

export interface WeeklyBakeModel extends CounterSummary {
  generatedAt: string;
  weekLabel: string;
  openingSummary: string;
  momentum: string[];
  shelfCheck: string[];
  nextBatch: string[];
}

export interface WeeklyBakeWriteResult {
  latestPath: string;
  snapshotPath: string;
}

export function buildWeeklyBakeModel(records: ActivityRecord[], now = new Date()): WeeklyBakeModel {
  const summary = buildCounterSummary(records);
  return {
    ...summary,
    generatedAt: now.toISOString(),
    weekLabel: getWeekLabel(now),
    openingSummary: buildOpeningSummary(summary),
    momentum: buildMomentum(summary.recurringThemes),
    shelfCheck: buildShelfCheck(summary.unbakedNotes),
    nextBatch: buildNextBatch(summary.unbakedNotes),
  };
}

export function generateWeeklyBakeHtml(model: WeeklyBakeModel): string {
  const tasteRows = Object.entries(model.tasteProfile)
    .map(([dimension, value]) => `<li><span>${escapeHtml(labelize(dimension))}</span><strong>${value}</strong></li>`)
    .join('');
  const themes = model.recurringThemes
    .map((theme) => `<li><strong>${escapeHtml(theme.name)}</strong><span>${theme.count} record${theme.count === 1 ? '' : 's'}</span></li>`)
    .join('');
  const work = model.recentAgentWork
    .map((record) => `<li><strong>${escapeHtml(record.summary)}</strong><span>${escapeHtml(record.topics.join(', ') || record.agent)}</span></li>`)
    .join('');
  const shelf = model.shelfCheck.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const next = model.nextBatch.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly Bake ${escapeHtml(model.weekLabel)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --page-bg: #f8f4ec;
      --panel-bg: #fffaf2;
      --text: #2d2924;
      --muted: #746b60;
      --border: #ded1bd;
      --accent: #8b5e34;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --page-bg: #191714;
        --panel-bg: #24211d;
        --text: #eee4d6;
        --muted: #b8aa98;
        --border: #40382f;
        --accent: #d4a15f;
      }
    }
    body {
      margin: 0;
      background: var(--page-bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
    }
    main {
      max-width: 1040px;
      margin-inline: auto;
      padding: 40px 24px 56px;
    }
    header {
      margin-block-end: 28px;
    }
    h1,
    h2 {
      margin: 0;
      letter-spacing: 0;
    }
    h1 {
      font-size: 2rem;
    }
    h2 {
      font-size: 1rem;
      margin-block-end: 12px;
    }
    .meta,
    .muted {
      color: var(--muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    section {
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 10px;
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-block-end: 1px solid var(--border);
      padding-block-end: 8px;
    }
    li:last-child {
      border-block-end: 0;
      padding-block-end: 0;
    }
    strong {
      font-weight: 650;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="meta">Knowledge Barkery</p>
      <h1>Weekly Bake</h1>
      <p class="muted">${escapeHtml(model.weekLabel)} · Generated ${escapeHtml(new Date(model.generatedAt).toLocaleString())}</p>
      <p>${escapeHtml(model.openingSummary)}</p>
    </header>
    <div class="grid">
      <section><h2>Recurring Themes</h2><ul>${themes || '<li><span>No recurring themes yet.</span></li>'}</ul></section>
      <section><h2>Taste Profile</h2><ul>${tasteRows}</ul></section>
      <section><h2>Recent Agent Work</h2><ul>${work || '<li><span>No activity records found.</span></li>'}</ul></section>
      <section><h2>Shelf Check</h2><ul>${shelf || '<li><span>No shelf check notes yet.</span></li>'}</ul></section>
      <section><h2>Next Batch</h2><ul>${next || '<li><span>No suggested next moves yet.</span></li>'}</ul></section>
    </div>
  </main>
</body>
</html>`;
}

export async function writeWeeklyBakeReport(
  app: App,
  model: WeeklyBakeModel,
): Promise<WeeklyBakeWriteResult> {
  await ensureAdapterDir(app, REPORT_DIR);
  await ensureAdapterDir(app, `${REPORT_DIR}/weekly`);
  const html = generateWeeklyBakeHtml(model);
  const latestPath = normalizeReportPath(`${REPORT_DIR}/latest.html`);
  const snapshotPath = normalizeReportPath(`${REPORT_DIR}/weekly/${model.weekLabel}.html`);
  await app.vault.adapter.write(latestPath, html);
  await app.vault.adapter.write(snapshotPath, html);
  return { latestPath, snapshotPath };
}

function buildOpeningSummary(summary: CounterSummary): string {
  const firstTheme = summary.recurringThemes[0]?.name;
  if (!firstTheme) {
    return 'There were no activity records in this period. The report will become more useful as agents and manual reflections leave lightweight session receipts.';
  }

  const recordsLabel = summary.coverage.recordsLogged === 1 ? 'record' : 'records';
  const itemsLabel = summary.unbakedNotes.length === 1 ? 'item' : 'items';
  return `Your recent knowledge work clustered around ${firstTheme}. The report is based on ${summary.coverage.recordsLogged} private summary ${recordsLabel}, with ${summary.unbakedNotes.length} ${itemsLabel} still worth baking into the vault.`;
}

function buildMomentum(themes: ActivityThemeSummary[]): string[] {
  return themes.slice(0, 3).map((theme) => `${theme.name} kept appearing across recent activity.`);
}

function buildShelfCheck(unbaked: ActivityRecord[]): string[] {
  return unbaked.slice(0, 5).map((record) => `${record.summary} may be worth turning into a note or knowledge page.`);
}

function buildNextBatch(unbaked: ActivityRecord[]): string[] {
  return unbaked.slice(0, 5).map((record) => `Cook: ${record.summary}`);
}

function getWeekLabel(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function labelize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeReportPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

async function ensureAdapterDir(app: App, path: string): Promise<void> {
  const normalized = normalizeReportPath(path);
  if (!(await app.vault.adapter.exists(normalized))) {
    await app.vault.adapter.mkdir(normalized);
  }
}
