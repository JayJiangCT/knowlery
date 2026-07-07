import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    // Unscoped runs (`eslint .`) must see exactly the code we maintain
    // (spec 0.8 f4, §4.1): generated artifacts, build shims (inert scanner
    // stand-ins, not application code), and local tool dirs are out.
    ignores: [
      // Any hidden directory: .venv*, .agents, .claude, and whatever local
      // tooling drops next (.remember, .worktrees, …) — maintainer acceptance
      // finding: enumerating them one by one is a losing game.
      '.*/**',
      'build/**',
      // Vitepress site scaffolding — not covered by the app tsconfig, never
      // linted before f4 either (status quo, not a new exemption).
      'docs-site/**',
      'evals/fixtures/**',
      'evals/reports/**',
      'knowlery-cli.mjs',
      'main.js',
      'node_modules/**',
      'src/assets/query-script.generated.ts',
    ],
  },
  {
    // obsidianmd's rules are plugin-release guidelines (no-console, window
    // timers, config-dir paths) — they apply to plugin source, not to test
    // fixtures or the eval runner (a CLI whose job is printing). Scoping the
    // preset to src also keeps its type-aware rules off files without type
    // info, which is what crashed unscoped runs before f4.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    extends: obsidianmd.configs.recommended,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Superset tsconfig so tests/ and evals/ get typed linting too —
        // they call the same APIs as src (spec 0.8 f4, §4.1).
        project: './tsconfig.eslint.json',
      },
    },
    rules: {
      // The eight rules 0.6-era config switched off to hide the warning debt,
      // re-enabled at error with the debt paid (spec 0.8 f4, §4.2).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      // `any` at the Obsidian API boundary is sometimes the honest type;
      // tightening this is recorded as possible future work, not f4 scope.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      // The CJK tokenizer uses control-plane regexes deliberately.
      'no-control-regex': 'off',
      // Redundant under the TypeScript type checker.
      'no-undef': 'off',
    },
  },
]);
