# Codex Hooks Design

## Goal

Add a small, layered hook set for Windows that improves safety, repository awareness, incremental validation, Supabase migration review, recovery, and continuity without remote writes, automatic commits, or duplicate notifications.

## Constraints

- Codex CLI 0.164.0 with the stable `hooks` feature.
- PowerShell 5.1-compatible scripts and `commandWindows` overrides.
- Global hooks only for universal safety rules.
- Project hooks for Git, pnpm/Vite/TypeScript/Vitest, Supabase, checkpoints, and continuity.
- Hook state lives under the Git directory so the working tree stays clean.
- Existing configuration and plugin hooks remain untouched.
- The existing global `notify = [..., "turn-ended"]` remains the only completion notifier.
- No network calls, remote Supabase mutations, commits, pushes, or permission bypasses.

## Architecture

### Global layer

`~/.codex/hooks.json` invokes `~/.codex/hooks/global-guard.ps1` for:

- `UserPromptSubmit`: reject prompts containing high-confidence credential formats without echoing the credential.
- `PreToolUse` for `Bash|apply_patch`: deny high-confidence destructive commands and writes to sensitive credential files.

The global guard is intentionally narrow. Ambiguous commands are allowed with no output to avoid false positives and latency.

### Project layer

`<repo>/.codex/hooks.json` invokes one project dispatcher for:

- `SessionStart`: provide concise Git state, unresolved conflicts, and the latest sanitized continuity note.
- `PreToolUse` for `Bash|apply_patch`: report Git state before relevant Git commands, deny remote Supabase mutations, and create a local patch checkpoint before structural edits.
- `PostToolUse` for `apply_patch`: scan changed Supabase migrations synchronously for dangerous SQL and run debounced quality checks asynchronously.
- `Stop`, `PreCompact`, and `SessionEnd`: save sanitized continuity state without reading unstable transcript formats.

### Checkpoints

Checkpoints are stored below `git rev-parse --git-path codex-hooks/checkpoints`. Each checkpoint contains metadata, `git status --porcelain`, a binary-capable tracked diff, and copies of existing structural target files. They are throttled by session and working-tree fingerprint. They never create commits or touch remotes.

### Incremental quality

The asynchronous quality hook coalesces rapid edits using a lock and a short quiet window. It fingerprints the current diff and skips states already checked. It runs:

- ESLint only for changed TypeScript/TSX files.
- Vitest related tests for changed source/test files.
- `tsc --noEmit --incremental` for changed TypeScript/config files.
- Full build only when build/package/router configuration changes.

Results are stored below the Git directory and returned as concise hook context. No environment values or command output containing secrets are persisted.

### Supabase policy

The project hook never invokes Supabase remotely. It denies high-confidence remote mutation commands such as `supabase db push`, remote migration application, function deploys, and secret writes. Migration patches are statically inspected for destructive DDL/DML, RLS disabling, privilege expansion, and transaction-risk patterns.

## Trust and rollout

Non-managed hooks require explicit trust in `/hooks`. Direct fixture tests validate scripts first; then a local Codex smoke test must be run only after the user reviews and trusts the exact definitions. The `--dangerously-bypass-hook-trust` flag is not used.
