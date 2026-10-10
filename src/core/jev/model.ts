/**
 * The Jev model Knowlery is pinned to. Lives apart from client.ts so read-only
 * consumers of `.knowlery/triage.json` (the scanner, the vault-side query script)
 * can check which model produced the scores without bundling the HTTP client.
 * Jev releases are not guaranteed to keep calibration across versions.
 */
export const JEV_MODEL = 'jev-1.13.0';
