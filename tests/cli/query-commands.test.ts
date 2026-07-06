import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { runQueryCommand } from '../../src/cli/commands/query';
import { runStaleCommand } from '../../src/cli/commands/stale';
import { CliError } from '../../src/cli/commands/shared';
import { scanVault } from '../../src/core/query/scan';
import { runQuery } from '../../src/core/query/engine';
import { computeStaleness } from '../../src/core/query/staleness';
import { formatQueryResult, formatStalenessReport } from '../../src/core/query/format';

const FIXTURE_VAULT = join(__dirname, '..', '..', 'evals', 'fixtures', 'vault');

function capture(): { log: (line: string) => void; output: () => string } {
  const lines: string[] = [];
  return { log: (line) => lines.push(line), output: () => lines.join('\n') };
}

describe('knowlery query (spec 0.7 f3, §5.1)', () => {
  it('is byte-identical to the engine + shared renderer', () => {
    const question = 'What did we decide about response time metrics?';
    const { log, output } = capture();
    runQueryCommand(FIXTURE_VAULT, { question, log });

    const direct = formatQueryResult(runQuery(question, scanVault(FIXTURE_VAULT), 12)).trimEnd();
    expect(output()).toBe(direct);
  });

  it('honors --k and --json', () => {
    const { log, output } = capture();
    runQueryCommand(FIXTURE_VAULT, { question: 'pulseboard metrics', k: 2, json: true, log });
    const parsed = JSON.parse(output()) as { verdict: string; candidates: unknown[] };
    expect(parsed.verdict).toBe('ok');
    expect(parsed.candidates.length).toBeLessThanOrEqual(2);
  });

  it('prints the abstention verdict without throwing (exit 0 path)', () => {
    const { log, output } = capture();
    runQueryCommand(FIXTURE_VAULT, { question: 'Which vendor did we shortlist for GPU procurement?', log });
    expect(output()).toContain('No confident matches in this vault for:');
  });

  it('rejects a missing question with usage and exit code 2', () => {
    const { log } = capture();
    try {
      runQueryCommand(FIXTURE_VAULT, { log });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(2);
      expect((error as CliError).message).toContain('knowlery query');
    }
  });
});

describe('knowlery stale (spec 0.7 f3, §5.2)', () => {
  it('is byte-identical to the staleness module + shared renderer', () => {
    const { log, output } = capture();
    runStaleCommand(FIXTURE_VAULT, { log });

    const direct = formatStalenessReport(computeStaleness(scanVault(FIXTURE_VAULT))).trimEnd();
    expect(output()).toBe(direct);
  });

  it('emits parseable json', () => {
    const { log, output } = capture();
    runStaleCommand(FIXTURE_VAULT, { json: true, log });
    const parsed = JSON.parse(output()) as { verdict: string; candidates: unknown[] };
    expect(parsed).toHaveProperty('stalePages');
    expect(parsed).toHaveProperty('uncookedNotes');
    expect(parsed).toHaveProperty('danglingSources');
  });
});
