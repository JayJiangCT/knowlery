/** Minimal `--flag value` / `--switch` parser shared by the compile-value CLIs. */
export function parseArgs(argv: readonly string[], switches: readonly string[] = []): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    if (switches.includes(name)) {
      out.set(name, 'true');
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
    out.set(name, value);
    i += 1;
  }
  return out;
}

export function required(args: Map<string, string>, name: string, usage: string): string {
  const value = args.get(name);
  if (!value) throw new Error(`Missing --${name}\n\n${usage}`);
  return value;
}

export function integer(args: Map<string, string>, name: string, fallback: number): number {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} must be a non-negative integer`);
  return value;
}

/** Runs a CLI body, printing errors without a stack trace and exiting non-zero. */
export function runCli(main: () => void): void {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
