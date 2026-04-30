# Knowlery Onboarding Installer — Design Spec

## 1. Goal

Reduce setup friction for non-technical users by extending the existing Knowlery setup wizard so it can optionally prepare the local agent environment, not just the vault structure.

This design adds guided detection, optional installation or preparation, and status feedback for:

- the currently selected agent CLI (`Claude Code` or `OpenCode`)
- external `skills` tooling support for skill discovery and install flows
- `Claudian`, installed directly from GitHub release assets without requiring BRAT

The result should feel like a natural extension of the current Knowlery wizard, not a separate installer product.

## 2. Product Boundaries

### In scope

- Support macOS and Windows
- Detect whether required tools are already installed
- Show optional install checkboxes inside the setup wizard
- Install only the CLI for the platform selected in the wizard
- Install `Claudian` optionally, with strong recommendation
- Attempt to auto-enable `Claudian` after installation
- Detect missing `Node.js`, provide a download link, and allow manual path entry plus auto-detect
- Show installation progress and per-item result states
- Allow vault setup to succeed even if optional installs fail

### Out of scope

- Linux support in v1
- Automatic Node.js installation
- Installing both `Claude Code` and `OpenCode` during the same wizard run
- Deep post-install login/auth flows for `Claude Code`, `OpenCode`, or `Claudian`
- A separate settings-page installer flow

## 3. User Experience Summary

The setup wizard remains a three-phase modal:

- `Preview`
- `Running`
- `Done`

The new environment preparation UI lives inside the existing wizard. Users first choose a platform, then review a preview that includes vault setup plus optional installs.

### Preview phase

The preview phase contains:

1. The existing platform selector
2. The existing setup preview sections
3. A new `Environment & Installs` section

The new section shows:

- the selected platform CLI (`Claude Code` or `OpenCode`)
- `Claudian`
- `skills` tooling

Each row shows:

- icon
- title
- one-line purpose description
- current status
- install checkbox when applicable

### Running phase

The running phase keeps the existing overall progress bar and step list, but expands the step model so optional environment installs appear as first-class tasks with their own status.

### Done phase

The done phase summarizes:

- which optional tools were already installed
- which were installed successfully
- which were skipped
- which failed and what the user should do next

If `Claudian` installs but cannot be auto-enabled, the user sees a direct manual fallback message telling them to enable it in Obsidian community plugins.

## 4. Installation Matrix

### Selected platform CLI

Only one platform CLI is shown at a time, based on the current wizard selection.

#### Claude Code

- Detect: `claude`
- macOS install path: `brew install --cask claude-code`
- Windows install path: `winget install Anthropic.ClaudeCode`

#### OpenCode

- Detect: `opencode`
- macOS install path: `brew install anomalyco/tap/opencode`
- Windows install path: `npm i -g opencode-ai@latest`

### skills tooling support

The official `skills` docs guarantee `npx skills ...` usage, not a required global install.

- Detect: run `npx skills --help` or an equivalent lightweight verification with a short timeout
- Prepare path on macOS and Windows: warm the tool through `npx` so later skill-browsing flows are less surprising
- Description should explicitly explain that this option prepares external skills tooling, and that the same flows can still work on demand through `npx`

### Claudian

- Detect installed: vault contains `.obsidian/plugins/claudian/manifest.json`
- Detect enabled: plugin id appears in Obsidian's enabled community plugin list
- Install path: download release assets from GitHub and write:
  - `main.js`
  - `manifest.json`
  - `styles.css`
- Destination: `.obsidian/plugins/claudian/`
- Post-install: attempt to auto-enable the plugin

## 5. Dependency Handling

### Node.js

`Node.js` is a prerequisite for the npm-based installation flows used by:

- `skills` tooling
- `OpenCode` on Windows

If Node.js is missing:

- rows that depend on it become disabled
- the UI explains why they are unavailable
- a download link is shown
- a `Node.js path` input is shown
- an `Auto-detect` action is shown

### Node.js path behavior

The wizard should support:

1. automatic detection from system PATH
2. automatic detection from common install locations
3. user-supplied absolute path
4. immediate re-check after manual path update or auto-detect

The path field should be optional and blank by default. It exists as a recovery path for machines where `node` is installed but not discoverable from the current Obsidian process.

## 6. Detection States

Each installable item uses the same normalized state model:

- `checking`
- `installed`
- `not-installed`
- `missing-dependency`
- `error`

Each run candidate also has a setup action state:

- `not-selected`
- `queued`
- `running`
- `verifying`
- `done`
- `failed`
- `skipped`

This state model must be shared across UI and core logic so the wizard does not invent ad hoc display rules.

## 7. Setup Flow

### Preview flow

1. User opens the wizard
2. Wizard loads existing vault manifest if present
3. Wizard detects environment state for:
   - selected platform CLI
   - `skills` tooling
   - `Claudian`
   - `Node.js`
4. Already-installed items display as completed and are not selected for install
5. Not-installed items can be checked for installation
6. Dependency-blocked items show explanation and recovery affordances

### Execution order

The setup runner should execute in this order:

1. create knowledge directories
2. write `KNOWLEDGE.md`, `SCHEMA.md`, and `INDEX.base`
3. install bundled Knowlery skills
4. generate platform config and default rules
5. write lock/manifest files
6. execute selected optional installs sequentially
7. verify each installed item after execution
8. render final summary

Optional installs happen after the core vault setup so the vault is never left uninitialized just because a CLI install fails.

## 8. Error Handling

### Core principle

Optional environment installation must be soft-failure, not setup-failure.

### Failure rules

- If core vault setup fails, the wizard fails
- If an optional install fails, setup still completes and the item is marked failed
- If `Claudian` installs but enablement fails, mark install success and enablement warning separately

### Error messaging

User-visible errors should be short and actionable:

- `Homebrew not found`
- `WinGet not available`
- `Node.js required`
- `Could not verify installation`
- `Installed Claudian but could not enable it automatically`

Raw error details can be retained internally for logs and debugging, but should not dominate the main UI.

## 9. UI Design Rules

This work must follow the existing Knowlery visual language in `styles.css`.

### Reuse existing patterns

- Keep the current wizard phases and footer
- Reuse platform-card styling for platform selection
- Reuse preview-section styling for grouped setup summaries
- Reuse existing button, badge, form-field, and progress styles
- Reuse existing muted/accent/success/warning color language

### New UI should feel native to the current wizard

- No separate installer modal
- No oversized hero cards
- No hardcoded colors or spacing
- No fake marketing-style download experience

### Install row layout

Each install row should be a compact, information-dense row with:

- left icon
- center text block with name and one-line help text
- right-side status cluster with checkbox, badge, or result

### Progress animation

Do not invent inaccurate percentage download bars for each tool.

Use honest state-based progress:

- spinner for `checking`, `running`, `verifying`
- check for success
- alert for failure
- muted label for skipped

The existing overall progress bar may remain step-driven rather than byte-driven.

## 10. Claudian Integration Details

The `Claudian` row should be marked as strongly recommended because it smooths over terminal complexity for new users and sits on top of the selected CLI.

### Installation flow

1. Query the latest GitHub release
2. Resolve the three required files
3. Ensure `.obsidian/plugins/claudian/` exists
4. Download and write the files
5. Verify files exist
6. Attempt to auto-enable plugin
7. Re-check install and enabled status

### Auto-enable behavior

Preferred behavior:

- update the Obsidian enabled-plugin registry
- refresh plugin state if the host environment allows it

Fallback behavior:

- if auto-enable fails, show a clear manual instruction in the Done phase

## 11. Architecture and File Layout

The implementation should avoid overloading `setup-wizard.tsx`.

### New core modules

- `src/core/environment-detect.ts`
  - detection for Node.js, platform CLI, `skills` tooling readiness, and `Claudian`
- `src/core/environment-install.ts`
  - installer registry, install orchestration, post-install verification
- `src/core/claudian-installer.ts`
  - release lookup, asset download, vault plugin write, auto-enable attempt

### Existing files to extend

- `src/modals/setup-wizard.tsx`
  - preview UI, install selections, running state, done summary
- `src/types.ts`
  - detection state, install item config, install result types
- `src/core/setup-executor.ts`
  - extend setup flow so optional installs can run after core vault initialization
- `styles.css`
  - wizard-specific rows, badges, Node.js path block, and result summary styles

## 12. Testing Strategy

### Unit-level logic

- detection state normalization
- installer selection based on OS and selected platform
- dependency gating for Node.js
- Claudian asset resolution and file presence verification

### Manual verification

This feature will require manual verification in real Obsidian environments:

- macOS with Homebrew available
- Windows with WinGet available
- machine with Node.js missing
- machine with CLI already installed
- Claudian install success plus auto-enable success
- Claudian install success plus auto-enable failure

### Regression checks

- existing setup wizard still works when all optional installs are unchecked
- reinstall/update flow still works when a manifest already exists
- current health/config screens still behave correctly after setup changes

## 13. Open Questions Resolved For v1

- Only current selected platform CLI is shown: yes
- Node.js auto-install: no
- Claudian auto-enable after install: yes, with fallback message
- `skills` tooling optional preparation: yes
- Separate post-install login guidance for Claudian users: no

## 14. Recommended Implementation Sequence

1. add shared types for detection and install states
2. implement environment detection
3. implement installer registry and install runner
4. implement Claudian download and enable flow
5. wire new preview UI into the wizard
6. wire running and done summaries
7. add styles
8. run manual verification across the supported paths
