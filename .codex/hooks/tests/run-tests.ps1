$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$script:Passed = 0
$script:Failed = 0
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$globalHook = Join-Path $env:USERPROFILE ".codex\hooks\global-guard.ps1"
$projectHook = Join-Path $repoRoot ".codex\hooks\project-hook.ps1"
$qualityHook = Join-Path $repoRoot ".codex\hooks\quality.ps1"

function Invoke-HookScript {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Payload,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = "powershell.exe"
    $start.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Path`""
    $start.WorkingDirectory = $WorkingDirectory
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    [void]$process.Start()
    $process.StandardInput.Write(($Payload | ConvertTo-Json -Depth 20 -Compress))
    $process.StandardInput.Close()
    $stdout = $process.StandardOutput.ReadToEnd().Trim()
    $stderr = $process.StandardError.ReadToEnd().Trim()
    $process.WaitForExit()

    $json = $null
    if ($stdout) {
        try { $json = $stdout | ConvertFrom-Json } catch { }
    }

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $stdout
        Stderr = $stderr
        Json = $json
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Assert-Contains {
    param([string]$Text, [string]$Expected, [string]$Message)
    if ($Text -notlike "*$Expected*") { throw "$Message`nExpected fragment: $Expected`nActual: $Text" }
}

function Test-Case {
    param([string]$Name, [scriptblock]$Body)
    try {
        & $Body
        $script:Passed++
        Write-Host "PASS $Name"
    } catch {
        $script:Failed++
        Write-Host "FAIL $Name"
        Write-Host "  $($_.Exception.Message)"
    }
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("codex-hooks-test-" + [guid]::NewGuid().ToString("N"))
[void](New-Item -ItemType Directory -Path $tempRoot)

try {
    & git -C $tempRoot init -b main-test 2>$null | Out-Null
    & git -C $tempRoot config user.email "hooks-test@example.invalid"
    & git -C $tempRoot config user.name "Codex Hooks Test"
    & git -C $tempRoot config core.autocrlf false
    [IO.File]::WriteAllText((Join-Path $tempRoot "package.json"), "{`"private`":true}")
    [void](New-Item -ItemType Directory -Path (Join-Path $tempRoot "src"))
    [IO.File]::WriteAllText((Join-Path $tempRoot "src\sample.ts"), "export const sample = 1;`n")
    & git -C $tempRoot add package.json src/sample.ts
    & git -C $tempRoot commit -m "fixture" 2>$null | Out-Null

    Test-Case "global guard allows a read-only Git command" {
        $result = Invoke-HookScript $globalHook @{
            session_id = "test"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "Bash"
            tool_input = @{ command = "git status --short" }
        } $tempRoot
        Assert-True ($result.ExitCode -eq 0) "Expected exit 0, got $($result.ExitCode): $($result.Stderr)"
        Assert-True (-not $result.Stdout) "Safe command should not emit hook output."
    }

    Test-Case "global guard denies destructive Git reset" {
        $result = Invoke-HookScript $globalHook @{
            session_id = "test"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "Bash"
            tool_input = @{ command = "git reset --hard HEAD~1" }
        } $tempRoot
        Assert-True ($result.Json.hookSpecificOutput.permissionDecision -eq "deny") "Expected a PreToolUse deny decision."
    }

    Test-Case "global guard denies a broad recursive delete" {
        $result = Invoke-HookScript $globalHook @{
            session_id = "test"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "Bash"
            tool_input = @{ command = "Remove-Item -LiteralPath C:\ -Recurse -Force" }
        } $tempRoot
        Assert-True ($result.Json.hookSpecificOutput.permissionDecision -eq "deny") "Expected root deletion to be denied."
    }

    Test-Case "global guard denies writes to secret-bearing files" {
        $patch = "*** Begin Patch`n*** Update File: .env`n@@`n-OLD=x`n+OPENAI_API_KEY=example`n*** End Patch"
        $result = Invoke-HookScript $globalHook @{
            session_id = "test"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "apply_patch"
            tool_input = @{ command = $patch }
        } $tempRoot
        Assert-True ($result.Json.hookSpecificOutput.permissionDecision -eq "deny") "Expected a sensitive-file patch to be denied."
    }

    Test-Case "global prompt guard blocks a high-confidence token" {
        $syntheticToken = "sk-proj-" + ("a" * 48)
        $result = Invoke-HookScript $globalHook @{
            session_id = "test"; cwd = $tempRoot; hook_event_name = "UserPromptSubmit"
            prompt = "Use this token $syntheticToken"
        } $tempRoot
        Assert-True ($result.Json.decision -eq "block") "Expected the prompt to be blocked."
        Assert-True ($result.Stdout -notlike "*$syntheticToken*") "Hook output leaked the token."
    }

    Test-Case "project policy denies remote Supabase mutation" {
        $result = Invoke-HookScript $projectHook @{
            session_id = "test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "Bash"
            tool_input = @{ command = "supabase db push --linked" }
        } $tempRoot
        Assert-True ($result.Json.hookSpecificOutput.permissionDecision -eq "deny") "Expected remote Supabase mutation to be denied."
    }

    Test-Case "project policy allows local Supabase inspection" {
        $result = Invoke-HookScript $projectHook @{
            session_id = "test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "Bash"
            tool_input = @{ command = "supabase status" }
        } $tempRoot
        Assert-True ($result.ExitCode -eq 0) "Expected local Supabase inspection to be allowed."
        Assert-True (-not $result.Stdout) "Local inspection should not emit a decision."
    }

    Test-Case "session context reports branch and Git state" {
        $result = Invoke-HookScript $projectHook @{
            session_id = "test"; cwd = $tempRoot; hook_event_name = "SessionStart"; source = "startup"
        } $tempRoot
        Assert-Contains $result.Stdout "main-test" "Expected active branch in SessionStart context."
        Assert-Contains $result.Stdout "Git" "Expected concise Git state in SessionStart context."
    }

    Test-Case "structural patch creates a recoverable checkpoint" {
        [IO.File]::AppendAllText((Join-Path $tempRoot "src\sample.ts"), "export const pending = 2;`n")
        $patch = "*** Begin Patch`n*** Update File: package.json`n@@`n-{`"private`":true}`n+{`"private`":true,`"type`":`"module`"}`n*** End Patch"
        $result = Invoke-HookScript $projectHook @{
            session_id = "checkpoint-test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "PreToolUse"; tool_name = "apply_patch"
            tool_input = @{ command = $patch }
        } $tempRoot
        Assert-True ($result.ExitCode -eq 0) "Checkpoint hook failed: $($result.Stderr)"
        $checkpointRoot = (& git -C $tempRoot rev-parse --git-path codex-hooks/checkpoints).Trim()
        if (-not [IO.Path]::IsPathRooted($checkpointRoot)) { $checkpointRoot = Join-Path $tempRoot $checkpointRoot }
        Assert-True (Test-Path -LiteralPath $checkpointRoot) "Checkpoint directory was not created."
        Assert-True (@(Get-ChildItem -LiteralPath $checkpointRoot -Directory).Count -ge 1) "No checkpoint was recorded."
    }

    Test-Case "migration patch reports destructive SQL" {
        $patch = "*** Begin Patch`n*** Add File: supabase/migrations/20261024000000_danger.sql`n+DROP TABLE public.accounts;`n*** End Patch"
        $result = Invoke-HookScript $projectHook @{
            session_id = "test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "PostToolUse"; tool_name = "apply_patch"
            tool_input = @{ command = $patch }; tool_response = @{ output = "Done" }
        } $tempRoot
        Assert-Contains $result.Stdout "DROP TABLE" "Expected a destructive migration warning."
    }

    Test-Case "continuity state redacts secrets and reloads safely" {
        $secret = "sk-proj-" + ("b" * 48)
        $stop = Invoke-HookScript $projectHook @{
            session_id = "continuity-test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "Stop"
            stop_hook_active = $false; last_assistant_message = "Implemented auth. Token $secret. Next: run tests."
        } $tempRoot
        Assert-True ($stop.ExitCode -eq 0) "Continuity save failed: $($stop.Stderr)"
        $stateRoot = (& git -C $tempRoot rev-parse --git-path codex-hooks/state).Trim()
        if (-not [IO.Path]::IsPathRooted($stateRoot)) { $stateRoot = Join-Path $tempRoot $stateRoot }
        $continuity = Get-Content -Raw -LiteralPath (Join-Path $stateRoot "continuity.md")
        Assert-True ($continuity -notlike "*$secret*") "Continuity file contains an unredacted secret."
        Assert-Contains $continuity "[REDACTED]" "Expected a redaction marker."
        $start = Invoke-HookScript $projectHook @{
            session_id = "continuity-test"; cwd = $tempRoot; hook_event_name = "SessionStart"; source = "resume"
        } $tempRoot
        Assert-Contains $start.Stdout "Next: run tests" "Expected saved continuity context on resume."
    }

    Test-Case "quality planner selects incremental checks without executing them" {
        $previous = $env:CODEX_HOOK_TEST_MODE
        $env:CODEX_HOOK_TEST_MODE = "1"
        try {
            $patch = "*** Begin Patch`n*** Update File: src/sample.ts`n@@`n-export const sample = 1;`n+export const sample = 2;`n*** Update File: vite.config.ts`n@@`n-old`n+new`n*** End Patch"
            $result = Invoke-HookScript $qualityHook @{
                session_id = "test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "PostToolUse"; tool_name = "apply_patch"
                tool_input = @{ command = $patch }; tool_response = @{ output = "Done" }
            } $tempRoot
            Assert-Contains $result.Stdout "lint" "Expected targeted lint in quality plan."
            Assert-Contains $result.Stdout "tests" "Expected related tests in quality plan."
            Assert-Contains $result.Stdout "typecheck" "Expected TypeScript check in quality plan."
            Assert-Contains $result.Stdout "build" "Expected structural build in quality plan."
        } finally {
            $env:CODEX_HOOK_TEST_MODE = $previous
        }
    }

    Test-Case "quality planner makes option-shaped paths safe CLI operands" {
        $previous = $env:CODEX_HOOK_TEST_MODE
        $env:CODEX_HOOK_TEST_MODE = "1"
        try {
            $patch = "*** Begin Patch`n*** Add File: --config=payload.ts`n+export const harmless = true;`n*** End Patch"
            $result = Invoke-HookScript $qualityHook @{
                session_id = "test"; turn_id = "turn"; cwd = $tempRoot; hook_event_name = "PostToolUse"; tool_name = "apply_patch"
                tool_input = @{ command = $patch }; tool_response = @{ output = "Done" }
            } $tempRoot
            Assert-Contains $result.Stdout "./--config=payload.ts" "Expected an explicit relative-path prefix before an option-shaped filename."
        } finally {
            $env:CODEX_HOOK_TEST_MODE = $previous
        }
    }
} finally {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    $systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedTemp.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedTemp -Leaf) -like "codex-hooks-test-*") {
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "RESULT passed=$script:Passed failed=$script:Failed"
if ($script:Failed -gt 0) { exit 1 }
