# Counter and Weekly Bake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.3 loop where Knowlery records lightweight agent activity, shows recent knowledge work on `Counter`, and manually generates a local `Weekly Bake` HTML report.

**Architecture:** Keep activity parsing, aggregation, and report generation in pure TypeScript modules so they can be unit-tested without Obsidian. Use Obsidian Vault/Adapter APIs only in thin IO modules and React components. Counter becomes the default dashboard tab; Skills remain available as `Pantry`, while Config and Health remain mostly unchanged for this release.

**Tech Stack:** TypeScript, React 18, Obsidian Plugin API, Zod, Vitest for pure unit tests, esbuild CJS bundle.

---

## File Structure

- Modify `package.json`
  - Add `test` and `test:watch` scripts.
  - Add `vitest` as a dev dependency.
- Modify `src/types.ts`
  - Add Activity Ledger types and schemas.
  - Add Counter/report view-model types.
  - Add `counter` to `DashboardTab`.
  - Add activity privacy/settings fields.
- Create `src/core/activity-model.ts`
  - Pure parsing and aggregation helpers.
  - No Obsidian imports.
- Create `src/core/activity-ledger.ts`
  - Obsidian adapter IO for `.knowlery/activity/*.jsonl`.
  - Append manual records and read recent records.
- Create `src/core/weekly-bake.ts`
  - Build report model from activity records and vault health data.
  - Generate standalone HTML.
  - Write `.knowlery/reports/latest.html` and weekly snapshot.
- Modify `src/assets/rules.ts`
  - Add default `activity-ledger.md` rule template for agents.
- Modify `src/core/rule-manager.ts`
  - Export a helper to install or refresh the activity logging rule for existing users.
- Create `src/modals/reflection-capture.tsx`
  - Small React modal to manually add a reflection when an agent did not log one.
- Create `src/views/CounterTab.tsx`
  - Default dashboard page.
  - Shows recurring themes, recent agent work, unbaked notes, report actions, and manual reflection entry.
- Modify `src/views/DashboardApp.tsx`
  - Add Counter tab as default.
  - Rename Skills tab label to Pantry without large redesign.
  - Wire report generation actions through plugin events or local callbacks.
- Modify `src/settings.tsx`
  - Add activity logging toggle.
  - Show activity storage paths.
  - Add install/refresh activity rule action.
- Modify `src/main.ts`
  - Add commands for generating/opening Weekly Bake and adding a reflection.
- Modify `styles.css`
  - Add Counter, report action, and reflection modal styles using Obsidian variables and logical properties.
- Create `tests/core/activity-model.test.ts`
  - Unit tests for JSONL parsing, theme aggregation, taste profile, and coverage.
- Create `tests/core/weekly-bake.test.ts`
  - Unit tests for report model and HTML structure.

## Task 1: Add Test Foundation

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Vitest dependency and scripts**

Run:

```bash
npm install -D vitest
```

Then update `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "docs:dev": "vitepress dev docs-site",
    "docs:build": "vitepress build docs-site",
    "docs:preview": "vitepress preview docs-site",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Run baseline tests**

Run:

```bash
npm test
```

Expected: Vitest starts and reports no test files found or exits with no tests, depending on Vitest version. If it fails because there are no tests, continue after adding Task 2 tests.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add vitest foundation"
```

## Task 2: Define Activity Model with Failing Tests

**Files:**
- Modify: `src/types.ts`
- Create: `src/core/activity-model.ts`
- Create: `tests/core/activity-model.test.ts`

- [ ] **Step 1: Write failing tests for parsing and aggregation**

Create `tests/core/activity-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCounterSummary,
  parseActivityJsonl,
} from '../../src/core/activity-model';

describe('parseActivityJsonl', () => {
  it('keeps valid records and reports malformed lines', () => {
    const result = parseActivityJsonl(
      [
        JSON.stringify({
          time: '2026-05-01T12:00:00.000Z',
          agent: 'codex',
          type: 'discussion',
          topics: ['Knowlery', 'Product Strategy'],
          summary: 'Discussed Counter and Weekly Bake.',
          dimensions: ['strategy', 'reflection'],
          questions: ['How does Knowlery get daily thinking signals?'],
          learned: ['Agent session receipts should be the main source.'],
          thinking: ['Avoid surveillance; use chosen traces.'],
          followups: ['Design Activity Ledger schema'],
          relatedFiles: ['docs/superpowers/specs/2026-05-01-counter-weekly-bake-design.md'],
          captureState: 'unbaked',
          source: { kind: 'agent-session', visibility: 'private-summary' },
        }),
        '{not-json',
      ].join('\n'),
      '.knowlery/activity/2026-05-01.jsonl',
    );

    expect(result.records).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.records[0].topics).toEqual(['Knowlery', 'Product Strategy']);
  });
});

describe('buildCounterSummary', () => {
  it('summarizes recurring themes, recent work, unbaked notes, taste profile, and coverage', () => {
    const summary = buildCounterSummary([
      {
        time: '2026-05-01T12:00:00.000Z',
        agent: 'codex',
        type: 'discussion',
        topics: ['Knowlery', 'Product Strategy'],
        summary: 'Discussed Counter and Weekly Bake.',
        dimensions: ['strategy', 'reflection'],
        questions: ['How does Knowlery get daily thinking signals?'],
        learned: ['Agent session receipts should be the main source.'],
        thinking: ['Avoid surveillance; use chosen traces.'],
        followups: ['Design Activity Ledger schema'],
        relatedFiles: [],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary' },
      },
      {
        time: '2026-05-01T13:00:00.000Z',
        agent: 'manual',
        type: 'reflection',
        topics: ['Knowlery'],
        summary: 'Captured a personal reflection about product direction.',
        dimensions: ['reflection'],
        questions: [],
        learned: ['Counter should feel warm, not like a KPI panel.'],
        thinking: ['Reports should be beautiful but restrained.'],
        followups: [],
        relatedFiles: [],
        captureState: 'baked',
        source: { kind: 'manual-reflection', visibility: 'private-summary' },
      },
    ]);

    expect(summary.recurringThemes[0]).toMatchObject({ name: 'Knowlery', count: 2 });
    expect(summary.recentAgentWork[0].summary).toContain('Captured a personal reflection');
    expect(summary.unbakedNotes).toHaveLength(1);
    expect(summary.tasteProfile.reflection).toBe(2);
    expect(summary.coverage.recordsLogged).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/core/activity-model.test.ts
```

Expected: FAIL because `src/core/activity-model.ts` does not exist.

- [ ] **Step 3: Add activity types**

Append these exports to `src/types.ts` near the dashboard types:

```ts
export const ActivityDimensionSchema = z.enum([
  'research',
  'creation',
  'building',
  'strategy',
  'reflection',
  'maintenance',
]);
export type ActivityDimension = z.infer<typeof ActivityDimensionSchema>;

export const ActivityRecordSchema = z.object({
  time: z.string(),
  agent: z.string().min(1),
  type: z.enum(['discussion', 'implementation', 'research', 'reflection', 'maintenance']),
  topics: z.array(z.string()).default([]),
  summary: z.string().min(1),
  dimensions: z.array(ActivityDimensionSchema).default([]),
  questions: z.array(z.string()).default([]),
  learned: z.array(z.string()).default([]),
  thinking: z.array(z.string()).default([]),
  followups: z.array(z.string()).default([]),
  relatedFiles: z.array(z.string()).default([]),
  captureState: z.enum(['unbaked', 'baked', 'ignored']).default('unbaked'),
  source: z.object({
    kind: z.enum(['agent-session', 'manual-reflection', 'imported']),
    visibility: z.enum(['private-summary']),
  }),
});
export type ActivityRecord = z.infer<typeof ActivityRecordSchema>;

export interface ActivityParseError {
  path: string;
  line: number;
  message: string;
}

export interface ActivityThemeSummary {
  name: string;
  count: number;
  lastSeen: string;
  records: number;
}

export interface CounterSummary {
  recurringThemes: ActivityThemeSummary[];
  recentAgentWork: ActivityRecord[];
  unbakedNotes: ActivityRecord[];
  tasteProfile: Record<ActivityDimension, number>;
  coverage: {
    recordsLogged: number;
    malformedRecords: number;
  };
}
```

Update settings and dashboard types:

```ts
export interface KnowlerySettings {
  kbName: string;
  platform: Platform;
  nodePath: string;
  onboardingDismissed: boolean;
  activityLoggingEnabled: boolean;
}

export const DEFAULT_SETTINGS: KnowlerySettings = {
  kbName: 'My Knowledge Base',
  platform: 'claude-code',
  nodePath: '',
  onboardingDismissed: false,
  activityLoggingEnabled: true,
};

export type DashboardTab = 'counter' | 'skills' | 'config' | 'health';
```

- [ ] **Step 4: Implement pure activity model**

Create `src/core/activity-model.ts`:

```ts
import type {
  ActivityDimension,
  ActivityParseError,
  ActivityRecord,
  ActivityThemeSummary,
  CounterSummary,
} from '../types';
import { ActivityRecordSchema } from '../types';

const DIMENSIONS: ActivityDimension[] = [
  'research',
  'creation',
  'building',
  'strategy',
  'reflection',
  'maintenance',
];

export function parseActivityJsonl(
  content: string,
  path: string,
): { records: ActivityRecord[]; errors: ActivityParseError[] } {
  const records: ActivityRecord[] = [];
  const errors: ActivityParseError[] = [];

  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      const result = ActivityRecordSchema.safeParse(parsed);
      if (result.success) {
        records.push(result.data);
      } else {
        errors.push({ path, line: index + 1, message: result.error.issues[0]?.message ?? 'Invalid activity record' });
      }
    } catch (error) {
      errors.push({
        path,
        line: index + 1,
        message: error instanceof Error ? error.message : 'Could not parse JSON',
      });
    }
  });

  return { records, errors };
}

export function buildCounterSummary(
  records: ActivityRecord[],
  malformedRecords = 0,
): CounterSummary {
  const sorted = [...records].sort((a, b) => b.time.localeCompare(a.time));
  const themeMap = new Map<string, ActivityThemeSummary>();
  const tasteProfile = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0])) as Record<ActivityDimension, number>;

  for (const record of sorted) {
    for (const dimension of record.dimensions) {
      tasteProfile[dimension] += 1;
    }
    for (const topic of record.topics) {
      const key = normalizeTopic(topic);
      if (!key) continue;
      const existing = themeMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.records += 1;
        if (record.time > existing.lastSeen) existing.lastSeen = record.time;
      } else {
        themeMap.set(key, {
          name: topic.trim(),
          count: 1,
          records: 1,
          lastSeen: record.time,
        });
      }
    }
  }

  return {
    recurringThemes: [...themeMap.values()]
      .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, 8),
    recentAgentWork: sorted.slice(0, 6),
    unbakedNotes: sorted.filter((record) => record.captureState === 'unbaked').slice(0, 5),
    tasteProfile,
    coverage: {
      recordsLogged: records.length,
      malformedRecords,
    },
  };
}

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase();
}
```

- [ ] **Step 5: Run tests and verify pass**

Run:

```bash
npm test -- tests/core/activity-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/core/activity-model.ts tests/core/activity-model.test.ts
git commit -m "feat: add activity model"
```

## Task 3: Add Activity Ledger Vault IO

**Files:**
- Create: `src/core/activity-ledger.ts`
- Modify: `tests/core/activity-model.test.ts` only if type adjustments are required

- [ ] **Step 1: Implement ledger paths and IO**

Create `src/core/activity-ledger.ts`:

```ts
import { App, normalizePath } from 'obsidian';
import type { ActivityParseError, ActivityRecord } from '../types';
import { ensureDir } from './vault-io';
import { parseActivityJsonl } from './activity-model';

export const ACTIVITY_DIR = '.knowlery/activity';
export const ACTIVITY_DISABLED_PATH = '.knowlery/activity-disabled';

export interface ActivityLedgerReadResult {
  records: ActivityRecord[];
  errors: ActivityParseError[];
}

export async function isActivityLoggingEnabled(app: App): Promise<boolean> {
  return !(await app.vault.adapter.exists(normalizePath(ACTIVITY_DISABLED_PATH)));
}

export async function setActivityLoggingEnabled(app: App, enabled: boolean): Promise<void> {
  const markerPath = normalizePath(ACTIVITY_DISABLED_PATH);
  if (enabled) {
    if (await app.vault.adapter.exists(markerPath)) {
      await app.vault.adapter.remove(markerPath);
    }
    return;
  }
  await ensureDir(app, '.knowlery');
  await app.vault.adapter.write(markerPath, 'Activity logging disabled by Knowlery settings.\n');
}

export async function appendActivityRecord(app: App, record: ActivityRecord): Promise<void> {
  if (!(await isActivityLoggingEnabled(app))) return;
  await ensureDir(app, ACTIVITY_DIR);
  const date = record.time.slice(0, 10);
  const path = normalizePath(`${ACTIVITY_DIR}/${date}.jsonl`);
  const existing = await app.vault.adapter.exists(path)
    ? await app.vault.adapter.read(path)
    : '';
  const next = `${existing}${existing.endsWith('\n') || existing.length === 0 ? '' : '\n'}${JSON.stringify(record)}\n`;
  await app.vault.adapter.write(path, next);
}

export async function readRecentActivityRecords(
  app: App,
  days = 14,
  now = new Date(),
): Promise<ActivityLedgerReadResult> {
  const adapter = app.vault.adapter;
  const dir = normalizePath(ACTIVITY_DIR);
  if (!(await adapter.exists(dir))) return { records: [], errors: [] };

  const wanted = new Set<string>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    wanted.add(`${date.toISOString().slice(0, 10)}.jsonl`);
  }

  const listing = await adapter.list(dir);
  const records: ActivityRecord[] = [];
  const errors: ActivityParseError[] = [];

  for (const filePath of listing.files) {
    const filename = filePath.split('/').pop();
    if (!filename || !wanted.has(filename)) continue;
    const content = await adapter.read(normalizePath(filePath));
    const parsed = parseActivityJsonl(content, filePath);
    records.push(...parsed.records);
    errors.push(...parsed.errors);
  }

  records.sort((a, b) => b.time.localeCompare(a.time));
  return { records, errors };
}
```

- [ ] **Step 2: Run type check**

Run:

```bash
npm run build
```

Expected: TypeScript passes and esbuild emits `main.js`.

- [ ] **Step 3: Commit**

```bash
git add src/core/activity-ledger.ts main.js
git commit -m "feat: add activity ledger storage"
```

## Task 4: Add Agent Activity Logging Rule

**Files:**
- Modify: `src/assets/rules.ts`
- Modify: `src/core/rule-manager.ts`

- [ ] **Step 1: Add rule template**

Add this object to `RULE_TEMPLATES` in `src/assets/rules.ts`:

```ts
{
  name: 'Activity ledger',
  description: 'Record lightweight private summaries of meaningful agent work',
  filename: 'activity-ledger.md',
  content: `# Activity Ledger

When meaningful work happens with the user, append one private summary record to:

\`.knowlery/activity/YYYY-MM-DD.jsonl\`

Before writing, check whether \`.knowlery/activity-disabled\` exists. If it exists, do not write an activity record.

Record only a concise summary. Do not store full conversation transcripts.

Write one JSON object per line using this shape:

\`\`\`json
{
  "time": "2026-05-01T14:20:00.000Z",
  "agent": "codex",
  "type": "discussion",
  "topics": ["Knowlery", "Product Strategy"],
  "summary": "Discussed shifting Knowlery from setup tool to personal knowledge review surface.",
  "dimensions": ["strategy", "reflection"],
  "questions": ["How should Knowlery capture what the user learns each day?"],
  "learned": ["Agent session receipts should be the main source."],
  "thinking": ["Avoid surveillance; use chosen traces instead."],
  "followups": ["Design Activity Ledger schema"],
  "relatedFiles": [],
  "captureState": "unbaked",
  "source": {
    "kind": "agent-session",
    "visibility": "private-summary"
  }
}
\`\`\`

Allowed dimensions:

- \`research\`
- \`creation\`
- \`building\`
- \`strategy\`
- \`reflection\`
- \`maintenance\`

Use \`captureState: "unbaked"\` when the discussion has not yet been turned into a durable note or knowledge page.
Use \`captureState: "baked"\` only when the useful result has already been captured in the vault.
`,
}
```

- [ ] **Step 2: Export install helper**

Add to `src/core/rule-manager.ts`:

```ts
export async function installActivityLedgerRule(
  app: App,
  platform: Platform,
): Promise<void> {
  const template = RULE_TEMPLATES.find((rule) => rule.filename === 'activity-ledger.md');
  if (!template) return;
  await writeRule(app, platform, template.filename, template.content);
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/assets/rules.ts src/core/rule-manager.ts main.js
git commit -m "feat: add activity logging rule"
```

## Task 5: Generate Weekly Bake Report

**Files:**
- Create: `src/core/weekly-bake.ts`
- Create: `tests/core/weekly-bake.test.ts`

- [ ] **Step 1: Write failing report tests**

Create `tests/core/weekly-bake.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildWeeklyBakeModel, generateWeeklyBakeHtml } from '../../src/core/weekly-bake';

describe('Weekly Bake report', () => {
  it('builds a model and HTML report from activity records', () => {
    const model = buildWeeklyBakeModel([
      {
        time: '2026-05-01T12:00:00.000Z',
        agent: 'codex',
        type: 'discussion',
        topics: ['Knowlery', 'Activity Ledger'],
        summary: 'Discussed how Knowlery should capture daily learning.',
        dimensions: ['strategy', 'reflection'],
        questions: ['How do we know what the user learned?'],
        learned: ['Use agent receipts, vault deltas, and manual reflections.'],
        thinking: ['The product should not feel like monitoring.'],
        followups: ['Create Counter'],
        relatedFiles: [],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary' },
      },
    ], new Date('2026-05-01T15:00:00.000Z'));

    const html = generateWeeklyBakeHtml(model);

    expect(model.recurringThemes[0].name).toBe('Knowlery');
    expect(model.nextBatch[0]).toContain('Cook');
    expect(html).toContain('Weekly Bake');
    expect(html).toContain('Taste Profile');
    expect(html).toContain('Shelf Check');
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- tests/core/weekly-bake.test.ts
```

Expected: FAIL because `src/core/weekly-bake.ts` does not exist.

- [ ] **Step 3: Implement report model and HTML generation**

Create `src/core/weekly-bake.ts`:

```ts
import { App, normalizePath } from 'obsidian';
import type { ActivityDimension, ActivityRecord, ActivityThemeSummary, CounterSummary } from '../types';
import { ensureDir } from './vault-io';
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
    h1, h2 {
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
    .meta, .muted {
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
  await ensureDir(app, REPORT_DIR);
  await ensureDir(app, `${REPORT_DIR}/weekly`);
  const html = generateWeeklyBakeHtml(model);
  const latestPath = normalizePath(`${REPORT_DIR}/latest.html`);
  const snapshotPath = normalizePath(`${REPORT_DIR}/weekly/${model.weekLabel}.html`);
  await app.vault.adapter.write(latestPath, html);
  await app.vault.adapter.write(snapshotPath, html);
  return { latestPath, snapshotPath };
}

function buildOpeningSummary(summary: CounterSummary): string {
  const firstTheme = summary.recurringThemes[0]?.name;
  if (!firstTheme) return 'There were no activity records in this period. The report will become more useful as agents and manual reflections leave lightweight session receipts.';
  return `Your recent knowledge work clustered around ${firstTheme}. The report is based on ${summary.coverage.recordsLogged} private summary record${summary.coverage.recordsLogged === 1 ? '' : 's'}, with ${summary.unbakedNotes.length} item${summary.unbakedNotes.length === 1 ? '' : 's'} still worth baking into the vault.`;
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
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/core/weekly-bake.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/weekly-bake.ts tests/core/weekly-bake.test.ts main.js
git commit -m "feat: generate weekly bake report"
```

## Task 6: Add Manual Reflection Capture

**Files:**
- Create: `src/modals/reflection-capture.tsx`
- Modify: `src/main.ts`

- [ ] **Step 1: Add capture modal**

Create `src/modals/reflection-capture.tsx`:

```tsx
import { App, Modal, Notice } from 'obsidian';
import { StrictMode, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import KnowleryPlugin from '../main';
import { PluginContext } from '../context';
import type { ActivityDimension, ActivityRecord } from '../types';
import { appendActivityRecord } from '../core/activity-ledger';

const DIMENSIONS: ActivityDimension[] = ['research', 'creation', 'building', 'strategy', 'reflection', 'maintenance'];

export class ReflectionCaptureModal extends Modal {
  private root: Root | null = null;

  constructor(app: App, private plugin: KnowleryPlugin, private onSaved?: () => void) {
    super(app);
  }

  onOpen() {
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <ReflectionCaptureForm
            onCancel={() => this.close()}
            onSave={async (record) => {
              await appendActivityRecord(this.app, record);
              new Notice('Reflection added to Knowlery activity.');
              this.onSaved?.();
              this.close();
            }}
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

function ReflectionCaptureForm(props: {
  onCancel: () => void;
  onSave: (record: ActivityRecord) => Promise<void>;
}) {
  const [summary, setSummary] = useState('');
  const [topics, setTopics] = useState('');
  const [questions, setQuestions] = useState('');
  const [learned, setLearned] = useState('');
  const [thinking, setThinking] = useState('');
  const [dimensions, setDimensions] = useState<ActivityDimension[]>(['reflection']);
  const [saving, setSaving] = useState(false);

  const toggleDimension = (dimension: ActivityDimension) => {
    setDimensions((current) => current.includes(dimension)
      ? current.filter((item) => item !== dimension)
      : [...current, dimension]);
  };

  const save = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    await props.onSave({
      time: new Date().toISOString(),
      agent: 'manual',
      type: 'reflection',
      topics: splitLinesOrCommas(topics),
      summary: summary.trim(),
      dimensions,
      questions: splitLines(questions),
      learned: splitLines(learned),
      thinking: splitLines(thinking),
      followups: [],
      relatedFiles: [],
      captureState: 'unbaked',
      source: { kind: 'manual-reflection', visibility: 'private-summary' },
    });
    setSaving(false);
  };

  return (
    <div className="knowlery-reflection">
      <h2>Add reflection</h2>
      <label>
        <span>Summary</span>
        <textarea value={summary} onChange={(event) => setSummary(event.currentTarget.value)} />
      </label>
      <label>
        <span>Topics</span>
        <input value={topics} onChange={(event) => setTopics(event.currentTarget.value)} placeholder="Knowlery, Product Strategy" />
      </label>
      <label>
        <span>Questions</span>
        <textarea value={questions} onChange={(event) => setQuestions(event.currentTarget.value)} />
      </label>
      <label>
        <span>Learned</span>
        <textarea value={learned} onChange={(event) => setLearned(event.currentTarget.value)} />
      </label>
      <label>
        <span>Thinking</span>
        <textarea value={thinking} onChange={(event) => setThinking(event.currentTarget.value)} />
      </label>
      <div className="knowlery-reflection__dimensions">
        {DIMENSIONS.map((dimension) => (
          <label key={dimension}>
            <input
              type="checkbox"
              checked={dimensions.includes(dimension)}
              onChange={() => toggleDimension(dimension)}
            />
            <span>{dimension}</span>
          </label>
        ))}
      </div>
      <div className="knowlery-modal__actions">
        <button onClick={props.onCancel}>Cancel</button>
        <button className="mod-cta" disabled={!summary.trim() || saving} onClick={save}>
          {saving ? 'Saving...' : 'Save reflection'}
        </button>
      </div>
    </div>
  );
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function splitLinesOrCommas(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}
```

- [ ] **Step 2: Add command**

Modify `src/main.ts` imports:

```ts
import { ReflectionCaptureModal } from './modals/reflection-capture';
```

Add command in `onload()`:

```ts
this.addCommand({
  id: 'add-reflection',
  name: 'Add reflection',
  callback: () => {
    new ReflectionCaptureModal(this.app, this, () => this.events.trigger('dashboard-refresh')).open();
  },
});
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modals/reflection-capture.tsx src/main.ts main.js
git commit -m "feat: add manual reflection capture"
```

## Task 7: Add Counter Tab

**Files:**
- Create: `src/views/CounterTab.tsx`
- Modify: `src/views/DashboardApp.tsx`
- Modify: `src/types.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create Counter tab component**

Create `src/views/CounterTab.tsx`:

```tsx
import { Notice } from 'obsidian';
import { useCallback, useEffect, useState } from 'react';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { buildWeeklyBakeModel, writeWeeklyBakeReport } from '../core/weekly-bake';
import { ReflectionCaptureModal } from '../modals/reflection-capture';
import { IconBookOpen, IconPlus, IconRefresh } from './Icons';

export function CounterTab() {
  const plugin = usePlugin();
  const [summary, setSummary] = useState<CounterSummary | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const result = await readRecentActivityRecords(plugin.app, 14);
    setSummary(buildCounterSummary(result.records, result.errors.length));
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    refresh();
    const ref = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      refresh(payload);
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refresh]);

  const addReflection = () => {
    new ReflectionCaptureModal(plugin.app, plugin, () => refresh()).open();
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const result = await readRecentActivityRecords(plugin.app, 7);
      const model = buildWeeklyBakeModel(result.records);
      const written = await writeWeeklyBakeReport(plugin.app, model);
      new Notice(`Weekly Bake generated: ${written.latestPath}`);
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  if (!summary) {
    return <div className="knowlery-counter" />;
  }

  return (
    <div className="knowlery-counter">
      <section className="knowlery-counter__hero">
        <div>
          <div className="knowlery-section-label">Counter</div>
          <p>Your quiet surface for recent agent work, open questions, and notes worth baking.</p>
        </div>
        <button className="knowlery-btn knowlery-btn--outline" onClick={addReflection}>
          <IconPlus size={14} />
          <span>Add reflection</span>
        </button>
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Recurring themes</div>
        {summary.recurringThemes.length === 0 ? (
          <EmptyCounterLine text="No themes yet. Activity records will appear here after agents or reflections leave summaries." />
        ) : (
          <div className="knowlery-counter__theme-list">
            {summary.recurringThemes.map((theme) => (
              <div key={theme.name} className="knowlery-counter__theme">
                <span>{theme.name}</span>
                <strong>{theme.count}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Recent agent work</div>
        {summary.recentAgentWork.length === 0 ? (
          <EmptyCounterLine text="No recent activity receipts found." />
        ) : (
          <div className="knowlery-counter__work-list">
            {summary.recentAgentWork.map((record) => (
              <article key={`${record.time}-${record.summary}`} className="knowlery-counter__work">
                <span className="knowlery-counter__work-meta">{record.agent} · {new Date(record.time).toLocaleString()}</span>
                <p>{record.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Unbaked notes</div>
        {summary.unbakedNotes.length === 0 ? (
          <EmptyCounterLine text="Nothing is marked unbaked right now." />
        ) : (
          <div className="knowlery-counter__work-list">
            {summary.unbakedNotes.map((record) => (
              <article key={`${record.time}-${record.summary}`} className="knowlery-counter__work">
                <p>{record.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Weekly Bake</div>
        <div className="knowlery-counter__report-actions">
          <button className="knowlery-btn knowlery-btn--outline" onClick={generateReport} disabled={generating}>
            {generating ? <IconRefresh size={14} /> : <IconBookOpen size={14} />}
            <span>{generating ? 'Generating...' : 'Generate report'}</span>
          </button>
          <span className="knowlery-counter__coverage">
            {summary.coverage.recordsLogged} records · {summary.coverage.malformedRecords} malformed
          </span>
        </div>
      </section>
    </div>
  );
}

function EmptyCounterLine(props: { text: string }) {
  return <p className="knowlery-counter__empty">{props.text}</p>;
}
```

- [ ] **Step 2: Wire Dashboard tabs**

Modify `src/views/DashboardApp.tsx` imports:

```ts
import { CounterTab } from './CounterTab';
```

Change tabs:

```ts
const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'counter', label: 'Counter', icon: 'chef-hat' },
  { id: 'skills', label: 'Pantry', icon: 'wrench' },
  { id: 'config', label: 'Config', icon: 'settings' },
  { id: 'health', label: 'Health', icon: 'activity' },
];
```

Change default tab and refresh state:

```ts
const [activeTab, setActiveTab] = useState<DashboardTab>('counter');

const [lastRefreshed, setLastRefreshed] = useState<Record<DashboardTab, Date | null>>({
  counter: null,
  skills: null,
  config: null,
  health: null,
});
```

Change active component selection:

```ts
const ActiveTabComponent = activeTab === 'counter'
  ? CounterTab
  : activeTab === 'skills'
    ? SkillsTab
    : activeTab === 'config'
      ? ConfigTab
      : HealthTab;
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS. If icon exports fail, adjust to existing icon names before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/views/CounterTab.tsx src/views/DashboardApp.tsx src/types.ts src/main.ts main.js
git commit -m "feat: add counter dashboard"
```

## Task 8: Add Activity Privacy Settings

**Files:**
- Modify: `src/settings.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Add settings UI**

In `src/settings.tsx`, import:

```ts
import { installActivityLedgerRule } from './core/rule-manager';
import { setActivityLoggingEnabled, ACTIVITY_DIR } from './core/activity-ledger';
```

Add a settings section after the platform section:

```ts
new Setting(containerEl)
  .setName('Activity logging')
  .setDesc(`Store private activity summaries in ${ACTIVITY_DIR}. Agents should write summaries only, not full conversations.`)
  .addToggle((toggle) => {
    toggle
      .setValue(this.plugin.settings.activityLoggingEnabled)
      .onChange(async (value) => {
        this.plugin.settings.activityLoggingEnabled = value;
        await this.plugin.saveSettings();
        await setActivityLoggingEnabled(this.app, value);
      });
  });

new Setting(containerEl)
  .setName('Activity ledger rule')
  .setDesc('Install or refresh the agent rule that asks agents to leave private session receipts.')
  .addButton((button) => {
    button
      .setButtonText('Refresh rule')
      .onClick(async () => {
        await installActivityLedgerRule(this.app, this.plugin.settings.platform);
        new Notice('Activity ledger rule refreshed.');
      });
  });
```

If `Notice` is not already imported in `settings.tsx`, add it to the existing Obsidian import.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/settings.tsx src/types.ts main.js
git commit -m "feat: add activity privacy settings"
```

## Task 9: Style Counter and Reflection Modal

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add styles using Obsidian variables**

Append to `styles.css`:

```css
/* ------------------------------------------------------------------ */
/*  Counter                                                           */
/* ------------------------------------------------------------------ */

.knowlery-counter {
  display: flex;
  flex-direction: column;
  gap: var(--knowlery-space-lg);
}

.knowlery-counter__hero,
.knowlery-counter__section {
  border: var(--knowlery-border);
  border-radius: var(--knowlery-radius-lg);
  background: var(--background-secondary);
  padding-block: var(--knowlery-space-lg);
  padding-inline: var(--knowlery-space-lg);
}

.knowlery-counter__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--knowlery-space-md);
}

.knowlery-counter__hero p,
.knowlery-counter__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--knowlery-body-size);
}

.knowlery-counter__theme-list,
.knowlery-counter__work-list {
  display: grid;
  gap: var(--knowlery-space-sm);
}

.knowlery-counter__theme {
  display: flex;
  justify-content: space-between;
  gap: var(--knowlery-space-md);
  padding-block: var(--knowlery-space-sm);
  border-block-end: var(--knowlery-border);
}

.knowlery-counter__theme:last-child {
  border-block-end: 0;
}

.knowlery-counter__theme span,
.knowlery-counter__work p {
  color: var(--text-normal);
}

.knowlery-counter__theme strong {
  color: var(--text-muted);
  font-size: var(--knowlery-meta-size);
}

.knowlery-counter__work {
  padding-block: var(--knowlery-space-sm);
  border-block-end: var(--knowlery-border);
}

.knowlery-counter__work:last-child {
  border-block-end: 0;
}

.knowlery-counter__work p {
  margin: 0;
}

.knowlery-counter__work-meta,
.knowlery-counter__coverage {
  color: var(--text-faint);
  font-size: var(--knowlery-meta-size);
}

.knowlery-counter__report-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--knowlery-space-md);
}

/* ------------------------------------------------------------------ */
/*  Reflection capture                                                 */
/* ------------------------------------------------------------------ */

.knowlery-reflection {
  display: grid;
  gap: var(--knowlery-space-md);
}

.knowlery-reflection h2 {
  margin: 0;
  color: var(--text-normal);
  font-size: var(--knowlery-lg-size);
}

.knowlery-reflection label {
  display: grid;
  gap: var(--knowlery-space-xs);
  color: var(--text-muted);
  font-size: var(--knowlery-meta-size);
}

.knowlery-reflection textarea {
  min-block-size: 80px;
}

.knowlery-reflection__dimensions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--knowlery-space-sm);
}

.knowlery-reflection__dimensions label {
  display: inline-flex;
  align-items: center;
  gap: var(--knowlery-space-xs);
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add styles.css main.js
git commit -m "style: add counter and reflection UI"
```

## Task 10: Final Verification

**Files:**
- No new files unless fixing issues discovered during verification.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript passes and esbuild emits `main.js`.

- [ ] **Step 3: Manual Obsidian verification**

In a test vault:

1. Enable Knowlery.
2. Initialize the vault if needed.
3. Confirm dashboard opens to `Counter`.
4. Confirm old Skills content is still reachable as `Pantry`.
5. Use command palette action `Knowlery: Add reflection`.
6. Confirm `.knowlery/activity/YYYY-MM-DD.jsonl` is written.
7. Confirm Counter shows the reflection in Recent Agent Work.
8. Click Generate report.
9. Confirm `.knowlery/reports/latest.html` and `.knowlery/reports/weekly/YYYY-Www.html` exist.
10. Open the HTML report from the filesystem and confirm it contains Weekly Bake, Recurring Themes, Taste Profile, Shelf Check, and Next Batch.
11. Disable activity logging in settings.
12. Confirm `.knowlery/activity-disabled` exists.
13. Re-enable activity logging and confirm the marker file is removed.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intentional files are modified. Existing unrelated `.gitignore` and `media/promo/` changes remain untouched.

- [ ] **Step 5: Commit fixes if needed**

If verification required small fixes:

```bash
git add <fixed-files>
git commit -m "fix: polish weekly bake flow"
```

## Self-Review Checklist

- Spec coverage:
  - Counter default surface: Task 7.
  - Activity Ledger: Tasks 2, 3, 4, 8.
  - Manual reflection source: Task 6.
  - Weekly Bake HTML report: Task 5.
  - Privacy controls: Task 8.
  - Tests: Tasks 1, 2, 5, 10.
- Scope control:
  - No chat UI.
  - No realtime analytics.
  - No custom hexagon dimensions.
  - No major Pantry or Inspection redesign.
  - No productivity scoring.
- Manual verification still required:
  - Obsidian dashboard layout in narrow side panel.
  - Local HTML opening experience.
  - Agent compliance with `activity-ledger.md` rule across Claude Code, Codex, and OpenCode.
