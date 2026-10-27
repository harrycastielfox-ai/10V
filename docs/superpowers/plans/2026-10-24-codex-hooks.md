# Codex Hooks Implementation Plan

**Goal:** Install and validate a layered global/project Codex hook set for Windows.

**Architecture:** A narrow global PowerShell guard handles universal destructive-command and credential protections. A project PowerShell dispatcher handles Git context, Supabase policy, checkpoints, continuity, and a debounced asynchronous quality runner. JSON hook files use only events and fields supported by Codex CLI 0.164.0.

**Tech Stack:** Codex hooks JSON, Windows PowerShell 5.1, Git, pnpm, ESLint, TypeScript, Vitest, Vite.

---

### Task 1: Executable hook contract tests

**Files:**
- Create: `.codex/hooks/tests/run-tests.ps1`

Write black-box fixture tests for allow/deny JSON, secret redaction, Git context, Supabase policy, SQL warnings, checkpoint creation, and continuity persistence. Run them before production scripts exist and confirm failure because the hook entry points are missing.

### Task 2: Global safety guard

**Files:**
- Create: `C:/Users/Henrique/.codex/hooks/global-guard.ps1`
- Create: `C:/Users/Henrique/.codex/hooks.json`

Implement minimal tested behavior for `UserPromptSubmit` and `PreToolUse`. Preserve the existing global `config.toml`; do not add notification hooks.

### Task 3: Project lifecycle and policy dispatcher

**Files:**
- Create: `.codex/hooks/project-hook.ps1`
- Create: `.codex/hooks.json`

Implement SessionStart Git/continuity context, PreToolUse Git/Supabase/checkpoint policy, PostToolUse SQL review, and Stop/PreCompact/SessionEnd continuity updates.

### Task 4: Debounced incremental quality runner

**Files:**
- Create: `.codex/hooks/quality.ps1`

Implement diff fingerprinting, coalescing, targeted lint/tests/typecheck, structural-build gating, concise result storage, and test-mode command planning.

### Task 5: Validation and handoff

Run hook contract tests, PowerShell parser checks, `codex doctor --summary`, strict config parsing, the project lint/test/build commands, and safe direct hook fixtures. Confirm no remote commands, commits, or pushes occurred. Report the manual `/hooks` trust step as pending if Codex still marks the definitions untrusted.

## Review focus

- No secret values in output or persisted state.
- No unsafe path resolution for checkpoint files.
- No false blocking of ordinary local development commands.
- No duplicate expensive quality runs.
- No remote Supabase side effects.
- Correct JSON shapes for each event.
