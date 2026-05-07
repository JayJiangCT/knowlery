import type { App } from 'obsidian';
import type {
  ActivityRecord,
  CounterSummary,
} from '../types';
import { buildCounterSummary } from './activity-model';

export const REPORT_DIR = '.knowlery/reports';

export interface WeeklyBakeModel extends CounterSummary {
  generatedAt: string;
  weekLabel: string;
  openingSummary: string;
  openingSummaryZh: string;
  language: 'zh' | 'en';
  mainThreads: Array<{
    title: string;
    note: string;
    meta: string;
  }>;
  learningHighlights: string[];
  openQuestions: string[];
  structuralSignals: string[];
  nextMoves: Array<{
    title: string;
    reason: string;
    prompt: string;
  }>;
  hexagon: Array<{
    key: string;
    labelEn: string;
    labelZh: string;
    value: number;
    insightEn: string;
    insightZh: string;
  }>;
  timeline: Array<{
    date: string;
    title: string;
    agent: string;
    summary: string;
    topics: string[];
    learned: string[];
    questions: string[];
    relatedFiles: string[];
  }>;
  extensions: Array<{
    title: string;
    files: string[];
    nextMove: string;
    prompt: string;
  }>;
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
    language: detectLanguage(records),
    openingSummary: buildOpeningSummary(summary, 'en'),
    openingSummaryZh: buildOpeningSummary(summary, 'zh'),
    mainThreads: buildMainThreads(summary, 'en'),
    learningHighlights: buildLearningHighlights(records),
    openQuestions: buildOpenQuestions(records),
    structuralSignals: buildStructuralSignals(summary, 'en'),
    nextMoves: buildNextMoves(summary, 'en'),
    hexagon: buildKnowledgeHexagon(summary),
    timeline: buildTimeline(records),
    extensions: buildExtensions(summary),
  };
}

export function generateWeeklyBakeHtml(model: WeeklyBakeModel): string {
  const totalFiles = unique(model.recentAgentWork.flatMap((record) => record.relatedFiles)).length;
  const generatedAt = new Date(model.generatedAt).toLocaleString();
  const enPanel = renderAtlasPanel(model, 'en', totalFiles, generatedAt);
  const zhPanel = renderAtlasPanel(model, 'zh', totalFiles, generatedAt);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Knowledge Review Atlas ${escapeHtml(model.weekLabel)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --page-bg: #faf9f6;
      --panel-bg: #ffffff;
      --soft-bg: #f3f1ec;
      --text: #24211d;
      --muted: #706b62;
      --faint: #9a9288;
      --border: #dedad2;
      --accent: #6f5a3d;
      --accent-soft: rgba(111, 90, 61, 0.12);
      --good: #4f7a5a;
      --radius: 10px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --page-bg: #171614;
        --panel-bg: #22201d;
        --soft-bg: #2a2723;
        --text: #eee9df;
        --muted: #b8b0a5;
        --faint: #8f867a;
        --border: #3d3933;
        --accent: #d2b48c;
        --accent-soft: rgba(210, 180, 140, 0.12);
        --good: #8ec79b;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      background: var(--page-bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.62;
    }
    main {
      max-width: 1180px;
      margin-inline: auto;
      padding: 42px 22px 72px;
    }
    header {
      display: grid;
      gap: 18px;
      margin-block-end: 28px;
    }
    h1, h2, h3, p {
      margin: 0;
      letter-spacing: 0;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 4.2rem);
      line-height: 1.08;
      font-weight: 720;
      max-width: 880px;
    }
    h2 {
      font-size: 1rem;
      margin-block-end: 12px;
      font-weight: 680;
    }
    h3 {
      font-size: 1rem;
      margin-block-end: 6px;
    }
    .meta, .muted, .eyebrow {
      color: var(--muted);
    }
    .eyebrow {
      color: var(--faint);
      font-size: 0.78rem;
      margin-block-end: 4px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      display: grid;
      gap: 2px;
    }
    .language {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--soft-bg);
      padding: 3px;
    }
    .language button {
      border: 0;
      border-radius: 6px;
      padding: 7px 10px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      cursor: pointer;
    }
    .language button[aria-pressed="true"] {
      background: var(--panel-bg);
      color: var(--text);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(290px, 0.85fr);
      gap: 18px;
      align-items: start;
    }
    .stack {
      display: grid;
      gap: 18px;
    }
    section {
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .lede {
      max-width: 840px;
      font-size: 1.06rem;
      color: var(--text);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .stat {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--panel-bg);
      padding: 15px;
    }
    .stat strong {
      display: block;
      font-size: 1.45rem;
      line-height: 1.1;
    }
    .stat span {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .hexagon {
      display: grid;
      grid-template-columns: minmax(200px, 280px) 1fr;
      gap: 18px;
      align-items: center;
    }
    .hexagon svg {
      width: 100%;
      max-width: 280px;
      aspect-ratio: 1;
    }
    .hexagon .axis {
      stroke: var(--border);
      stroke-width: 1;
    }
    .hexagon .shape {
      fill: var(--accent-soft);
      stroke: var(--accent);
      stroke-width: 3;
    }
    .hexagon .label {
      fill: var(--muted);
      font-size: 11px;
    }
    .dimension-list {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    .dimension-list li {
      display: grid;
      gap: 4px;
    }
    .bar {
      height: 5px;
      border-radius: 999px;
      background: var(--soft-bg);
      overflow: hidden;
    }
    .bar span {
      display: block;
      width: calc(var(--value) * 20%);
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
    }
    .timeline {
      position: relative;
      display: grid;
      gap: 14px;
    }
    .timeline article {
      position: relative;
      border-inline-start: 2px solid var(--border);
      padding-inline-start: 16px;
      padding-block: 1px;
    }
    .timeline article::before {
      content: "";
      position: absolute;
      inset-inline-start: -6px;
      inset-block-start: 6px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 10px;
    }
    .chip {
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      padding: 2px 8px;
      font-size: 0.76rem;
    }
    .constellation {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      min-height: 180px;
      padding: 8px 0;
    }
    .node {
      display: inline-grid;
      place-items: center;
      min-width: calc(54px + var(--weight) * 16px);
      min-height: calc(34px + var(--weight) * 9px);
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--text);
      padding: 8px 12px;
      font-size: 0.9rem;
    }
    .extension {
      border-block-start: 1px solid var(--border);
      padding-block-start: 13px;
      margin-block-start: 13px;
    }
    .extension:first-of-type {
      border-block-start: 0;
      padding-block-start: 0;
      margin-block-start: 0;
    }
    .thread,
    .move {
      border-block-start: 1px solid var(--border);
      padding-block-start: 14px;
      margin-block-start: 14px;
    }
    .thread:first-of-type,
    .move:first-of-type {
      border-block-start: 0;
      padding-block-start: 0;
      margin-block-start: 0;
    }
    ul {
      list-style: disc;
      padding: 0;
      padding-inline-start: 1.15rem;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    li {
      padding-inline-start: 2px;
    }
    .metric-list {
      list-style: none;
      padding-inline-start: 0;
    }
    .metric-list li {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      border-block-end: 1px solid var(--border);
      padding-block-end: 7px;
    }
    .metric-list li:last-child {
      border-block-end: 0;
      padding-block-end: 0;
    }
    strong {
      font-weight: 650;
    }
    pre {
      white-space: pre-wrap;
      margin: 10px 0 0;
      padding: 12px;
      border-radius: 6px;
      background: var(--soft-bg);
      color: var(--text);
      font-size: 0.9rem;
      line-height: 1.6;
    }
    [hidden] {
      display: none !important;
    }
    @media (max-width: 760px) {
      main {
        padding-inline: 18px;
      }
      .grid,
      .hexagon,
      .stats {
        grid-template-columns: 1fr;
      }
      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="topbar">
        <div class="brand">
          <p class="meta">Knowledge Barkery</p>
          <p class="muted">Weekly knowledge review atlas</p>
        </div>
        <div class="language" aria-label="Language">
          <button type="button" data-lang="en" aria-pressed="true">English</button>
          <button type="button" data-lang="zh" aria-pressed="false">中文</button>
        </div>
      </div>
      <div data-lang-panel="en">${enPanel}</div>
      <div data-lang-panel="zh" hidden>${zhPanel}</div>
    </header>
  </main>
  <script>
    const buttons = Array.from(document.querySelectorAll('[data-lang]'));
    const panels = Array.from(document.querySelectorAll('[data-lang-panel]'));
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const lang = button.getAttribute('data-lang');
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        panels.forEach((panel) => {
          panel.hidden = panel.getAttribute('data-lang-panel') !== lang;
        });
      });
    });
  </script>
</body>
</html>`;
}

type AtlasLocale = 'en' | 'zh';

function renderAtlasPanel(
  model: WeeklyBakeModel,
  locale: AtlasLocale,
  totalFiles: number,
  generatedAt: string,
): string {
  const labels = locale === 'zh' ? ZH_LABELS : EN_LABELS;
  const mainThreads = buildMainThreads(model, locale)
    .map((thread) => `<article class="thread"><p class="eyebrow">${escapeHtml(thread.meta)}</p><h3>${escapeHtml(thread.title)}</h3><p>${escapeHtml(thread.note)}</p></article>`)
    .join('');
  const learning = model.learningHighlights
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const questions = model.openQuestions
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const signals = buildStructuralSignals(model, locale)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const next = buildNextMoves(model, locale)
    .map((item) => `<article class="move"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reason)}</p><pre>${escapeHtml(item.prompt)}</pre></article>`)
    .join('');
  const themes = model.recurringThemes
    .map((theme) => `<span class="node" style="--weight:${Math.min(theme.count, 5)}">${escapeHtml(theme.name)}</span>`)
    .join('');
  const timeline = model.timeline
    .map((item) => renderTimelineItem(item, locale))
    .join('');
  const extensions = model.extensions
    .map((extension) => renderExtension(extension, locale))
    .join('');

  return `
    <h1>${escapeHtml(labels.title)}</h1>
    <p class="muted">${escapeHtml(model.weekLabel)} · ${escapeHtml(labels.generated)} ${escapeHtml(generatedAt)}</p>
    <p class="lede">${escapeHtml(locale === 'zh' ? model.openingSummaryZh : model.openingSummary)}</p>
    <div class="stats">
      <div class="stat"><strong>${model.coverage.recordsLogged}</strong><span>${escapeHtml(labels.records)}</span></div>
      <div class="stat"><strong>${model.knowledgeThreads.length}</strong><span>${escapeHtml(labels.threads)}</span></div>
      <div class="stat"><strong>${totalFiles}</strong><span>${escapeHtml(labels.files)}</span></div>
      <div class="stat"><strong>${model.unbakedNotes.length}</strong><span>${escapeHtml(labels.unbaked)}</span></div>
    </div>
    <div class="grid">
      <div class="stack">
        <section><h2>${escapeHtml(labels.hexagon)}</h2>${renderHexagon(model.hexagon, locale)}</section>
        <section><h2>${escapeHtml(labels.timeline)}</h2><div class="timeline">${timeline || `<p class="muted">${escapeHtml(labels.empty)}</p>`}</div></section>
        <section><h2>${escapeHtml(labels.extensions)}</h2>${extensions || `<p class="muted">${escapeHtml(labels.empty)}</p>`}</section>
      </div>
      <div class="stack">
        <section><h2>${escapeHtml(labels.mainThreads)}</h2>${mainThreads || `<p class="muted">${escapeHtml(labels.empty)}</p>`}</section>
        <section><h2>${escapeHtml(labels.constellation)}</h2><div class="constellation">${themes || `<p class="muted">${escapeHtml(labels.empty)}</p>`}</div></section>
        <section><h2>${escapeHtml(labels.learning)}</h2><ul>${learning || `<li>${escapeHtml(labels.noLearning)}</li>`}</ul></section>
        <section><h2>${escapeHtml(labels.questions)}</h2><ul>${questions || `<li>${escapeHtml(labels.noQuestions)}</li>`}</ul></section>
        <section><h2>${escapeHtml(labels.signals)}</h2><ul>${signals}</ul></section>
        <section><h2>${escapeHtml(labels.nextMoves)}</h2>${next || `<p class="muted">${escapeHtml(labels.noMoves)}</p>`}</section>
      </div>
    </div>`;
}

function renderHexagon(model: WeeklyBakeModel['hexagon'], locale: AtlasLocale): string {
  const axis = model.map((_, index) => {
    const end = hexagonPoint(index, 5, 72);
    return `<line class="axis" x1="100" y1="100" x2="${end.x}" y2="${end.y}" />`;
  }).join('');
  const polygon = model.map((item, index) => {
    const point = hexagonPoint(index, item.value, 72);
    return `${point.x},${point.y}`;
  }).join(' ');
  const labels = model.map((item, index) => {
    const point = hexagonPoint(index, 5, 90);
    const text = locale === 'zh' ? item.labelZh : item.labelEn;
    return `<text class="label" x="${point.x}" y="${point.y}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(text)}</text>`;
  }).join('');
  const dimensions = model.map((item) => {
    const label = locale === 'zh' ? item.labelZh : item.labelEn;
    const insight = locale === 'zh' ? item.insightZh : item.insightEn;
    return `<li><strong>${escapeHtml(label)} · ${item.value}/5</strong><div class="bar" style="--value:${item.value}"><span></span></div><span class="muted">${escapeHtml(insight)}</span></li>`;
  }).join('');

  return `<div class="hexagon">
    <svg viewBox="0 0 200 200" role="img" aria-label="Knowledge hexagon">
      <polygon class="axis" points="${model.map((_, index) => {
        const point = hexagonPoint(index, 5, 72);
        return `${point.x},${point.y}`;
      }).join(' ')}" fill="none" />
      ${axis}
      <polygon class="shape" points="${polygon}" />
      ${labels}
    </svg>
    <ul class="dimension-list">${dimensions}</ul>
  </div>`;
}

function renderTimelineItem(item: WeeklyBakeModel['timeline'][number], locale: AtlasLocale): string {
  const learned = item.learned.slice(0, 2).map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('');
  const questions = item.questions.slice(0, 2).map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('');
  const files = item.relatedFiles.slice(0, 3).map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('');
  const topics = item.topics.slice(0, 4).map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('');
  const detail = [topics, learned, questions, files].filter(Boolean).join('');
  const date = new Date(item.date).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric' });
  return `<article>
    <p class="eyebrow">${escapeHtml(date)} · ${escapeHtml(item.agent)}</p>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary)}</p>
    ${detail ? `<div class="chips">${detail}</div>` : ''}
  </article>`;
}

function renderExtension(extension: WeeklyBakeModel['extensions'][number], locale: AtlasLocale): string {
  const labels = locale === 'zh' ? ZH_LABELS : EN_LABELS;
  const files = extension.files.length > 0
    ? extension.files.map((file) => `<span class="chip">${escapeHtml(file)}</span>`).join('')
    : `<span class="chip">${escapeHtml(labels.noFiles)}</span>`;
  return `<article class="extension">
    <p class="eyebrow">${escapeHtml(labels.extensionFlow)}</p>
    <h3>${escapeHtml(extension.title)} → ${escapeHtml(extension.nextMove)}</h3>
    <div class="chips">${files}</div>
    <pre>${escapeHtml(extension.prompt)}</pre>
  </article>`;
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

function buildOpeningSummary(summary: CounterSummary, locale: AtlasLocale): string {
  const firstTheme = summary.recurringThemes[0]?.name;
  if (!firstTheme) {
    return locale === 'zh'
      ? '这周还没有可复盘的知识活动。等 agent 或手动 reflection 留下记录后，Knowledge Atlas 会把它们整理成可以继续思考的线索。'
      : 'There is not enough knowledge activity to review yet. Once agents or manual reflections leave lightweight receipts, this atlas will turn them into trails you can revisit.';
  }

  const secondTheme = summary.recurringThemes[1]?.name;
  const thread = summary.knowledgeThreads[0];
  if (locale === 'zh') {
    const themePhrase = secondTheme ? `「${firstTheme}」和「${secondTheme}」` : `「${firstTheme}」`;
    const next = thread ? `下一步最值得做的是 ${thread.nextMove.toLowerCase()}：${explainReportMove(thread.nextMove, 'zh')}` : '下一步可以选一条线索继续整理。';
    return `这周的知识工作主要围绕 ${themePhrase} 展开。重点不只是新增了 ${summary.coverage.recordsLogged} 条记录，而是这些材料开始暴露出可以连接、追问和复用的结构。${next}`;
  }

  const themePhrase = secondTheme ? `${firstTheme} and ${secondTheme}` : firstTheme;
  const next = thread ? `The most useful next move is ${thread.nextMove.toLowerCase()}: ${explainReportMove(thread.nextMove, 'en')}` : 'Pick one trail and keep shaping it with a small move.';
  const recordLabel = summary.coverage.recordsLogged === 1 ? 'record' : 'records';
  return `This week, your knowledge work clustered around ${themePhrase}. The value is not just that ${summary.coverage.recordsLogged} activity ${recordLabel} were added, but that the material is starting to reveal connections, questions, and reusable structure. ${next}`;
}

function buildMainThreads(summary: CounterSummary, locale: AtlasLocale): WeeklyBakeModel['mainThreads'] {
  return summary.knowledgeThreads.slice(0, 3).map((thread) => ({
    title: thread.title,
    meta: locale === 'zh'
      ? `${thread.recordsCount} 条记录 · ${thread.relatedFiles.length} 个文件 · 下一步：${thread.nextMove}`
      : `${thread.recordsCount} ${thread.recordsCount === 1 ? 'record' : 'records'} · ${thread.relatedFiles.length} ${thread.relatedFiles.length === 1 ? 'file' : 'files'} · Next: ${thread.nextMove}`,
    note: buildThreadReportNote(thread.title, thread.stage, thread.nextMove, thread.recordsCount, thread.relatedFiles.length, locale),
  }));
}

function buildLearningHighlights(records: ActivityRecord[]): string[] {
  const learned = unique(records.flatMap((record) => record.learned)).slice(0, 8);
  if (learned.length > 0) return learned;
  return records
    .filter((record) => record.type === 'research' || record.dimensions.includes('research'))
    .map((record) => summarize(record.summary))
    .slice(0, 5);
}

function buildOpenQuestions(records: ActivityRecord[]): string[] {
  const questions = unique(records.flatMap((record) => record.questions)).slice(0, 6);
  if (questions.length > 0) return questions;
  return unique(records.flatMap((record) => record.thinking)).slice(0, 4);
}

function buildStructuralSignals(summary: CounterSummary, locale: AtlasLocale): string[] {
  const files = unique(summary.recentAgentWork.flatMap((record) => record.relatedFiles));
  const baked = summary.recentAgentWork.filter((record) => record.captureState === 'baked').length;
  const unbaked = summary.unbakedNotes.length;
  const signals = locale === 'zh'
    ? [
      `${summary.coverage.recordsLogged} 条活动记录中，${baked} 条已经沉淀，${unbaked} 条仍值得继续整理。`,
      `${files.length} 个 vault 文件被本周活动触达，说明这不是孤立对话，而是已经在改变知识库结构。`,
    ]
    : [
      `${summary.coverage.recordsLogged} activity records were captured; ${baked} are already baked and ${unbaked} still deserve follow-up.`,
      `${files.length} vault files were touched by recent activity, so these conversations are already shaping the knowledge base.`,
    ];

  const topThread = summary.knowledgeThreads[0];
  if (topThread) {
    signals.push(locale === 'zh'
      ? `最活跃线索是「${topThread.title}」，目前处在 ${topThread.stage} 阶段，下一步适合 ${topThread.nextMove}。`
      : `The most active trail is ${topThread.title}. It is in ${topThread.stage}, and the next useful move is ${topThread.nextMove}.`);
  }

  if (summary.coverage.malformedRecords > 0) {
    signals.push(locale === 'zh'
      ? `${summary.coverage.malformedRecords} 条 activity 记录格式异常，需要修复，否则会影响后续复盘。`
      : `${summary.coverage.malformedRecords} activity records are malformed and should be repaired before relying on trend analysis.`);
  }

  return signals;
}

function buildNextMoves(summary: CounterSummary, locale: AtlasLocale): WeeklyBakeModel['nextMoves'] {
  const threadMoves = summary.knowledgeThreads.slice(0, 2).map((thread) => ({
    title: `${thread.nextMove}: ${thread.title}`,
    reason: explainReportMove(thread.nextMove, locale),
    prompt: thread.suggestedRequest,
  }));

  const followups = unique(summary.recentAgentWork.flatMap((record) => record.followups)).slice(0, 3);
  const followupMoves = followups.map((followup) => ({
    title: locale === 'zh' ? `继续推进：${followup}` : `Follow up: ${followup}`,
    reason: locale === 'zh'
      ? '这条 follow-up 来自本周的 agent 工作记录，适合在下次会话中直接推进。'
      : 'This follow-up came from recent agent work and is a good candidate for the next focused session.',
    prompt: `请帮我继续推进这个 follow-up：「${followup}」。先回看相关笔记，再判断它应该沉淀成概念、对比、实体，还是普通笔记。`,
  }));

  return [...threadMoves, ...followupMoves].slice(0, 4);
}

function buildThreadReportNote(
  title: string,
  stage: string,
  nextMove: string,
  recordsCount: number,
  filesCount: number,
  locale: AtlasLocale,
): string {
  if (locale === 'en') {
    const material = `${recordsCount} activity ${recordsCount === 1 ? 'record' : 'records'} and ${filesCount} related ${filesCount === 1 ? 'file' : 'files'}`;
    if (stage === 'Capture' && nextMove === 'Connect') {
      return `${title} has accumulated ${material}. The next value is not more material, but linking it to older notes, adjacent concepts, and reusable patterns.`;
    }
    if (nextMove === 'Question') {
      return `${title} has enough shape to start checking assumptions, evidence, and counterexamples.`;
    }
    if (nextMove === 'Create') {
      return `${title} is close to an output state and can become a template, checklist, comparison, or decision note.`;
    }
    return `${title} left ${material} this week. A small next move is better than a full restructure.`;
  }

  const material = `${recordsCount} 条活动记录和 ${filesCount} 个相关文件`;
  if (stage === 'Capture' && nextMove === 'Connect') {
    return `「${title}」已经积累了 ${material}，现在的价值不在于继续堆材料，而在于把它和旧笔记、相邻概念、可复用模式连接起来。`;
  }
  if (nextMove === 'Question') {
    return `「${title}」已经有了初步结构，适合开始检查假设、证据和反例，让它从材料变成更可靠的判断。`;
  }
  if (nextMove === 'Create') {
    return `「${title}」已经接近可输出状态，可以被整理成模板、清单、对比页或决策记录。`;
  }
  return `「${title}」本周留下了 ${material}，适合用一个小动作继续推进，而不是一次性重构。`;
}

function explainReportMove(nextMove: string, locale: AtlasLocale): string {
  if (locale === 'en') {
    if (nextMove === 'Connect') {
      return 'Link new material to older notes, adjacent concepts, and reusable experience so it becomes part of the knowledge network.';
    }
    if (nextMove === 'Question') {
      return 'Check assumptions, evidence, and counterexamples before treating the idea as settled knowledge.';
    }
    if (nextMove === 'Create') {
      return 'Turn a mature structure into a template, checklist, comparison, or decision note.';
    }
    if (nextMove === 'Clean') {
      return 'Repair drift, duplicates, and missing metadata so the vault stays maintainable.';
    }
    return 'Choose one active trail and make a small move that increases reuse.';
  }

  if (nextMove === 'Connect') {
    return '把新材料和旧笔记、相邻概念、已有经验连起来，让它成为知识网络的一部分。';
  }
  if (nextMove === 'Question') {
    return '检查假设、证据和反例，避免把还不稳固的想法过早沉淀。';
  }
  if (nextMove === 'Create') {
    return '把已经成熟的结构转成模板、清单、对比页或决策记录。';
  }
  if (nextMove === 'Clean') {
    return '清理重复、漂移和缺失元数据，让知识库保持可维护。';
  }
  return '选择一条最活跃的线索，做一个足够小但能增加复用性的动作。';
}

function buildKnowledgeHexagon(summary: CounterSummary): WeeklyBakeModel['hexagon'] {
  const profile = summary.tasteProfile;
  const threads = summary.knowledgeThreads.length;
  const files = unique(summary.recentAgentWork.flatMap((record) => record.relatedFiles)).length;
  const questions = unique(summary.recentAgentWork.flatMap((record) => record.questions)).length;
  const followups = unique(summary.recentAgentWork.flatMap((record) => record.followups)).length;
  const unbaked = summary.unbakedNotes.length;

  return [
    {
      key: 'research',
      labelEn: 'Research',
      labelZh: '研究',
      value: score(profile.research + questions),
      insightEn: questions > 0 ? `${questions} question${questions === 1 ? '' : 's'} are still alive.` : 'Research is quiet this week.',
      insightZh: questions > 0 ? `还有 ${questions} 个问题值得继续追。` : '这周研究面相对安静。',
    },
    {
      key: 'creation',
      labelEn: 'Creation',
      labelZh: '创作',
      value: score(profile.creation + followups),
      insightEn: followups > 0 ? `${followups} follow-up${followups === 1 ? '' : 's'} can become outputs.` : 'There are few output-oriented moves yet.',
      insightZh: followups > 0 ? `${followups} 个 follow-up 可以转成输出。` : '还没有太多输出型动作。',
    },
    {
      key: 'connection',
      labelEn: 'Connection',
      labelZh: '连接',
      value: score(threads + files),
      insightEn: `${threads} active trail${threads === 1 ? '' : 's'} touched ${files} file${files === 1 ? '' : 's'}.`,
      insightZh: `${threads} 条活跃线索触达了 ${files} 个文件。`,
    },
    {
      key: 'reflection',
      labelEn: 'Reflection',
      labelZh: '反思',
      value: score(profile.reflection + profile.strategy),
      insightEn: 'Reflection grows when strategy and self-review appear together.',
      insightZh: '当策略和自我复盘一起出现时，反思维度会升高。',
    },
    {
      key: 'structure',
      labelEn: 'Structure',
      labelZh: '结构',
      value: score(profile.maintenance + profile.building + files),
      insightEn: files > 0 ? 'The work is touching real vault structure, not just chat summaries.' : 'Structure will grow once records point to vault files.',
      insightZh: files > 0 ? '这些工作已经触达真实 vault 结构，而不只是聊天摘要。' : '当记录指向具体文件后，结构维度会变强。',
    },
    {
      key: 'action',
      labelEn: 'Action',
      labelZh: '行动',
      value: score(followups + Math.max(0, summary.coverage.recordsLogged - unbaked)),
      insightEn: unbaked > 0 ? `${unbaked} item${unbaked === 1 ? '' : 's'} still need a small next move.` : 'Most captured items are already in motion.',
      insightZh: unbaked > 0 ? `${unbaked} 条材料还需要一个小动作。` : '大多数材料已经进入推进状态。',
    },
  ];
}

function buildTimeline(records: ActivityRecord[]): WeeklyBakeModel['timeline'] {
  return [...records]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 8)
    .map((record) => ({
      date: record.time,
      title: record.topics[0] ?? record.summary,
      agent: record.agent,
      summary: summarize(record.summary),
      topics: record.topics,
      learned: record.learned,
      questions: record.questions,
      relatedFiles: record.relatedFiles,
    }));
}

function buildExtensions(summary: CounterSummary): WeeklyBakeModel['extensions'] {
  return summary.knowledgeThreads.slice(0, 4).map((thread) => ({
    title: thread.title,
    files: thread.relatedFiles.slice(0, 4),
    nextMove: thread.nextMove,
    prompt: thread.suggestedRequest,
  }));
}

function hexagonPoint(index: number, value: number, radius: number): { x: number; y: number } {
  const normalized = Math.max(0, Math.min(5, value)) / 5;
  const angle = (-90 + index * 60) * (Math.PI / 180);
  const distance = radius * normalized;
  return {
    x: Number((100 + Math.cos(angle) * distance).toFixed(2)),
    y: Number((100 + Math.sin(angle) * distance).toFixed(2)),
  };
}

function score(value: number): number {
  return Math.max(1, Math.min(5, Math.ceil(value)));
}

function detectLanguage(records: ActivityRecord[]): 'zh' | 'en' {
  const sample = records.map((record) => `${record.summary} ${record.topics.join(' ')} ${record.learned.join(' ')}`).join(' ');
  const cjkCount = (sample.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjkCount >= 8 ? 'zh' : 'en';
}

function getWeekLabel(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function summarize(value: string): string {
  return value.length > 140 ? `${value.slice(0, 140)}…` : value;
}

const ZH_LABELS = {
  title: '本周知识地图',
  generated: '生成于',
  records: '活动记录',
  threads: '活跃线索',
  files: '触达文件',
  unbaked: '待沉淀',
  hexagon: '知识六边形',
  timeline: '知识时间线',
  extensions: '知识延伸链路',
  constellation: '主题星图',
  mainThreads: '本周主线',
  learning: '真正学到的东西',
  questions: '值得继续追问',
  signals: '结构信号',
  nextMoves: '下周烘焙菜单',
  extensionFlow: 'AI 讨论 → 文件 → 下一步',
  noFiles: '暂无关联文件',
  empty: '暂无足够记录。',
  noLearning: '还没有明确的 learned 字段；下次可以让 agent 在活动记录里写下本次学到的东西。',
  noQuestions: '这周没有留下明确问题。',
  noMoves: '暂无建议动作。',
};

const EN_LABELS = {
  title: 'Knowledge Review Atlas',
  generated: 'Generated',
  records: 'activity records',
  threads: 'active trails',
  files: 'vault files touched',
  unbaked: 'unbaked items',
  hexagon: 'Knowledge Hexagon',
  timeline: 'Knowledge Timeline',
  extensions: 'Knowledge Extensions',
  constellation: 'Topic Constellation',
  mainThreads: 'Main Threads',
  learning: 'What You Learned',
  questions: 'Questions Worth Keeping',
  signals: 'Structural Signals',
  nextMoves: 'Next Batch',
  extensionFlow: 'AI discussion → files → next move',
  noFiles: 'No linked files yet',
  empty: 'Not enough records yet.',
  noLearning: 'No explicit learned notes yet.',
  noQuestions: 'No open questions were recorded this week.',
  noMoves: 'No suggested moves yet.',
};

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
