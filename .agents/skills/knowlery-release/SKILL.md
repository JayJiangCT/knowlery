---
name: knowlery-release
description: Use when the user says to prepare, cut, publish, or plan a Knowlery release, including phrases like "准备发布", "release prep", "cut a release", "发布版本", "打 tag", or "发 BRAT beta". Guides the exact Knowlery Obsidian plugin release workflow, branch discipline, version files, changelog, build verification, tag rules, and push/release guardrails.
---

# Knowlery Release

Use this skill for Knowlery release preparation and publishing.

## Core Rules

- Never push commits, push tags, create GitHub releases, or open an Obsidian Community Plugins PR without explicit user confirmation in the current conversation.
- Never tag with a leading `v`. Tags must exactly match `manifest.json` `version`, for example `0.2.0`.
- Keep `package.json`, `manifest.json`, and `versions.json` aligned.
- Only change `minAppVersion` when a new Obsidian API requirement forces it.
- Release assets are exactly `main.js`, `manifest.json`, and `styles.css`.
- Use a dedicated release branch before editing release metadata.
- Do not include test-vault files or local Obsidian data in commits.

## Default Flow

1. Inspect state:
   - `git status --short --branch`
   - current branch and recent commits
   - current versions in `package.json`, `manifest.json`, and `versions.json`

2. Confirm version:
   - Recommend semver based on change scope.
   - For this project, feature releases usually bump minor, fixes bump patch.
   - If the user has already named a version, use it.

3. Create or switch to release branch:
   - Default branch name: `codex/release-X.Y.Z`
   - If a release branch already exists, ask before reusing it unless the user explicitly requested it.

4. Update release metadata:
   - `package.json`: `version`
   - `package-lock.json`: matching package version if present
   - `manifest.json`: `version`
   - `versions.json`: append `"X.Y.Z": "<minAppVersion>"`
   - `CHANGELOG.md`: add a concise entry for the release

5. Build and verify:
   - `npm run build`
   - `git diff --check`
   - confirm `main.js`, `manifest.json`, and `styles.css` exist and are non-empty
   - confirm `manifest.json` version equals package version
   - confirm `versions.json` contains the new version

6. Commit release prep:
   - Stage only release-related files and generated release assets when intended.
   - Commit message: `chore: release X.Y.Z`

7. Ask before irreversible publishing steps:
   - Ask before `git tag X.Y.Z`
   - Ask before `git push`
   - Ask before `git push --tags`
   - Ask before creating or editing GitHub releases
   - Ask before Obsidian Community Plugins submission work

## Publishing Flow After Confirmation

Run only after the user explicitly confirms publishing:

1. Tag:
   - `git tag X.Y.Z`

2. Push:
   - `git push`
   - `git push --tags`

3. GitHub Actions:
   - The release workflow validates that the tag equals `manifest.json` version.
   - The workflow builds and attaches `main.js`, `manifest.json`, and `styles.css`.

4. Post-push checks:
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
- whether tag/push/release were intentionally not performed
- exact next command/action pending user confirmation
