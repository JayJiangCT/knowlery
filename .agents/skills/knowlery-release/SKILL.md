---
name: knowlery-release
description: Use when the user says to prepare, cut, publish, or plan a Knowlery release, including phrases like "准备发布", "release prep", "cut a release", "发布版本", "打 tag", or "发 BRAT beta". Guides the exact Knowlery Obsidian plugin release workflow, branch discipline, version files, changelog, build verification, tag rules, and push/release guardrails.
---

# Knowlery Release

Use this skill for Knowlery release preparation and publishing.

## Core Rules

- Never push commits, push tags, create GitHub releases, or open an Obsidian Community Plugins PR without explicit user confirmation in the current conversation.
- Never create a PR before asking the user for confirmation after release prep commit and verification are complete.
- Never tag with a leading `v`. Tags must exactly match `manifest.json` `version`, for example `0.2.0`.
- Never tag or publish before the release PR has been reviewed and merged.
- Keep `package.json`, `manifest.json`, and `versions.json` aligned.
- Only change `minAppVersion` when a new Obsidian API requirement forces it.
- Release assets are exactly `main.js`, `manifest.json`, and `styles.css`.
- Use a dedicated release branch before editing release metadata, named from the confirmed version and change type.
- Do not include test-vault files or local Obsidian data in commits.

## Default Flow

1. Inspect state:
   - `git status --short --branch`
   - current branch and recent commits
   - current versions in `package.json`, `manifest.json`, and `versions.json`

2. Confirm version:
   - Recommend semver based on change scope.
   - For this project, feature releases usually bump minor, fixes bump patch.
   - Ask the user to confirm the target version before editing release metadata unless they already gave an explicit version in the current conversation.

3. Decide branch name from change type:
   - Bug fix release: `codex/fix-X.Y.Z-release` or `codex/release-X.Y.Z`
   - Feature release: `codex/feature-X.Y.Z-release` or `codex/release-X.Y.Z`
   - Pure release metadata after work already happened: `codex/release-X.Y.Z`
   - Prefer the style the user names. If unspecified, recommend one and ask for confirmation.
   - If a release branch already exists, ask before reusing it unless the user explicitly requested it.

4. Update release metadata:
   - `package.json`: `version`
   - `package-lock.json`: matching package version if present
   - `manifest.json`: `version`
   - `versions.json`: append `"X.Y.Z": "<minAppVersion>"`
   - `CHANGELOG.md`: add a concise entry for the release

5. Build, inspect, and verify:
   - `npm run build`
   - `git diff --check`
   - confirm `main.js`, `manifest.json`, and `styles.css` exist and are non-empty
   - confirm `manifest.json` version equals package version
   - confirm `versions.json` contains the new version
   - inspect `git diff --stat` and `git status --short --branch` before commit

6. Commit release prep:
   - Stage only release-related files and generated release assets when intended.
   - Commit message: `chore: release X.Y.Z`

7. Ask before PR:
   - Summarize version, branch, commit, and verification.
   - Ask the user whether to create a PR.
   - Only after confirmation, push the branch and create a draft PR to `main`.

8. Review and merge:
   - Use PR review feedback to make fixes on the same release branch.
   - Re-run verification after fixes.
   - Do not merge unless the user explicitly asks or confirms.
   - After merge, sync local `main` before tagging.

9. Ask before publishing steps:
   - Ask before `git tag X.Y.Z` on the merged release commit/main.
   - Ask before `git push --tags`
   - Ask before creating or editing GitHub releases or release notes
   - Ask before Obsidian Community Plugins submission work

## PR Flow After Confirmation

Run only after the user explicitly confirms PR creation:

1. Push the release branch:
   - `git push -u origin <branch>`

2. Create a draft PR:
   - Base: `main`
   - Head: release branch
   - Title: `Release X.Y.Z <short feature/fix label>`
   - Body includes summary, compatibility notes, validation, and a note that tag/release are not done yet.

3. Report PR URL and state.

## Publishing Flow After Merge and Confirmation

Run only after the release PR has been merged and the user explicitly confirms publishing:

1. Sync local main:
   - `git switch main`
   - `git pull --ff-only`
   - confirm `manifest.json` version equals the target release

2. Tag:
   - `git tag X.Y.Z`

3. Push tag:
   - `git push --tags`

4. GitHub Actions:
   - The release workflow validates that the tag equals `manifest.json` version.
   - The workflow builds and attaches `main.js`, `manifest.json`, and `styles.css`.

5. Release notes:
   - If GitHub Actions creates the release automatically, verify notes/assets after workflow completion.
   - If manual release notes are required, draft them from `CHANGELOG.md` and ask before publishing.

6. Post-publish checks:
   - Confirm the release workflow status if asked or if GitHub tooling is available.
   - Confirm release assets are present before telling users to install via BRAT.

## Community Plugins Submission

Only do this when explicitly requested:

1. Ensure the GitHub release already exists with required assets.
2. Ensure README discloses network and command usage.
3. Prepare PR to `obsidianmd/obsidian-releases` with:
   - `id`: `knowlery`
   - `name`: `Knowlery`
   - `author`: `Jay Jiang`
   - `repo`: `JayJiangCT/knowlery`
   - description matching `manifest.json`

## Final Response Checklist

When release prep is complete, report:

- release branch
- version
- commit SHA
- verification commands and outcomes
- whether PR/tag/push/release were intentionally not performed
- exact next command/action pending user confirmation
