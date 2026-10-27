$ErrorActionPreference = "Continue"
Set-StrictMode -Version 2.0

function Write-CompactJson { param([hashtable]$Value) [Console]::Out.WriteLine(($Value | ConvertTo-Json -Depth 12 -Compress)) }
function Get-Hash {
    param([string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Protect-Text {
    param([string]$Text)
    $result = if ($null -eq $Text) { "" } else { $Text }
    foreach ($pattern in @(
        '(?i)\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b',
        '(?i)\bgh[pousr]_[A-Za-z0-9]{20,}\b',
        '(?i)\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}\b',
        '(?im)^\s*[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|SERVICE_ROLE_KEY)\s*=\s*.+$'
    )) { $result = [regex]::Replace($result, $pattern, '[REDACTED]') }
    return $result
}
function Get-PatchPaths {
    param([string]$Patch)
    $paths = New-Object System.Collections.Generic.List[string]
    foreach ($match in [regex]::Matches($Patch, '(?im)^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$')) {
        $path = $match.Groups[1].Value.Trim().Replace('\', '/')
        if (-not $paths.Contains($path)) { [void]$paths.Add($path) }
    }
    return @($paths)
}
function Get-Plan {
    param([string[]]$Paths)
    $checks = New-Object System.Collections.Generic.List[string]
    if ($Paths | Where-Object { $_ -match '(?i)\.(?:ts|tsx)$' }) { [void]$checks.Add('lint') }
    if ($Paths | Where-Object { $_ -match '(?i)^src/.+\.(?:ts|tsx)$' }) { [void]$checks.Add('tests') }
    if ($Paths | Where-Object { $_ -match '(?i)\.(?:ts|tsx)$|(?:^|/)tsconfig[^/]*\.json$|(?:^|/)vite\.config\.[^/]+$' }) { [void]$checks.Add('typecheck') }
    if ($Paths | Where-Object { $_ -match '(?i)(?:^|/)(?:package\.json|pnpm-lock\.yaml|vite\.config\.[^/]+|tsconfig[^/]*\.json)$|^src/(?:routes?|router)(?:/|\.)' }) { [void]$checks.Add('build') }
    return @($checks)
}
function ConvertTo-CliOperand {
    param([string]$Path)
    if ([IO.Path]::IsPathRooted($Path)) { return $Path }
    return "./" + $Path.Replace('\', '/')
}
function Get-RepoRoot {
    param([string]$WorkingDirectory)
    $output = @(& git -C $WorkingDirectory rev-parse --show-toplevel 2>$null)
    $exitCode = $LASTEXITCODE
    $root = $output | Select-Object -First 1
    if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($root)) { return $null }
    return [IO.Path]::GetFullPath($root.Trim())
}
function Get-GitStoragePath {
    param([string]$RepoRoot, [string]$RelativePath)
    $output = @(& git -C $RepoRoot rev-parse --git-path $RelativePath 2>$null)
    $path = $output | Select-Object -First 1
    if (-not [IO.Path]::IsPathRooted($path)) { $path = Join-Path $RepoRoot $path }
    return [IO.Path]::GetFullPath($path)
}
function Invoke-Check {
    param([string]$Name, [string]$RepoRoot, [string[]]$Arguments)
    $started = [DateTime]::UtcNow
    $output = @(& pnpm.cmd @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    $safe = Protect-Text (($output | Select-Object -Last 30) -join "`n")
    if ($safe.Length -gt 3500) { $safe = $safe.Substring($safe.Length - 3500) }
    return [pscustomobject]@{ Name = $Name; ExitCode = $exitCode; Seconds = [math]::Round(([DateTime]::UtcNow - $started).TotalSeconds, 1); Output = $safe }
}

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
try { $event = $raw | ConvertFrom-Json } catch { [Console]::Error.WriteLine("Invalid hook JSON."); exit 1 }
$command = if ($event.tool_input.PSObject.Properties.Name -contains "command") { [string]$event.tool_input.command } else { "" }
$eventPaths = @(Get-PatchPaths $command)
$initialPlan = @(Get-Plan $eventPaths)

if ($env:CODEX_HOOK_TEST_MODE -eq "1") {
    $safeOperands = @($eventPaths | ForEach-Object { ConvertTo-CliOperand $_ })
    Write-CompactJson @{ hookSpecificOutput = @{ hookEventName = "PostToolUse"; additionalContext = "Planned checks: " + ($initialPlan -join ', ') + "; safe operands: " + ($safeOperands -join ', ') } }
    exit 0
}

$cwd = [string]$event.cwd
$repoRoot = Get-RepoRoot $cwd
if (-not $repoRoot -or -not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) { exit 0 }
$stateRoot = Get-GitStoragePath $repoRoot "codex-hooks/state"
[void](New-Item -ItemType Directory -Force -Path $stateRoot)
$triggerPath = Join-Path $stateRoot "quality-trigger.txt"
[IO.File]::WriteAllText($triggerPath, [DateTime]::UtcNow.Ticks.ToString())
$lockPath = Join-Path $stateRoot "quality.lock"
$lock = $null
try {
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) } catch { exit 0 }
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $seen = (Get-Item -LiteralPath $triggerPath).LastWriteTimeUtc
        Start-Sleep -Milliseconds 700
        $quiet = ((Get-Item -LiteralPath $triggerPath).LastWriteTimeUtc -eq $seen)
    } while (-not $quiet -and [DateTime]::UtcNow -lt $deadline)

    $changed = @(& git -C $repoRoot diff --name-only HEAD -- 2>$null)
    $changed += @(& git -C $repoRoot ls-files --others --exclude-standard 2>$null)
    $changed = @($changed | ForEach-Object { $_.Replace('\', '/') } | Sort-Object -Unique)
    $plan = @(Get-Plan $changed)
    if ($plan.Count -eq 0) { exit 0 }

    $status = (@(& git -C $repoRoot status --porcelain=v1 --untracked-files=normal 2>$null) -join "`n")
    $diff = (@(& git -C $repoRoot diff --no-ext-diff HEAD -- 2>$null) -join "`n")
    $fingerprint = Get-Hash ($status + "`n" + $diff)
    $fingerprintPath = Join-Path $stateRoot "quality-fingerprint.txt"
    if ((Test-Path -LiteralPath $fingerprintPath) -and ((Get-Content -Raw -LiteralPath $fingerprintPath).Trim() -eq $fingerprint)) { exit 0 }

    $results = New-Object System.Collections.Generic.List[object]
    $tsFiles = @($changed | Where-Object { $_ -match '(?i)\.(?:ts|tsx)$' -and (Test-Path -LiteralPath (Join-Path $repoRoot $_)) })
    $sourceFiles = @($changed | Where-Object { $_ -match '(?i)^src/.+\.(?:ts|tsx)$' -and (Test-Path -LiteralPath (Join-Path $repoRoot $_)) })
    # Git paths are untrusted CLI operands. Prefix relative paths so names such
    # as `--config=payload.ts` cannot be reinterpreted as ESLint/Vitest options.
    $tsCliFiles = @($tsFiles | ForEach-Object { ConvertTo-CliOperand $_ })
    $sourceCliFiles = @($sourceFiles | ForEach-Object { ConvertTo-CliOperand $_ })
    Push-Location $repoRoot
    try {
        if ($plan -contains 'lint' -and $tsCliFiles.Count -gt 0) { [void]$results.Add((Invoke-Check 'lint' $repoRoot (@('exec', 'eslint', '--no-warn-ignored', '--') + $tsCliFiles))) }
        if ($plan -contains 'tests' -and $sourceCliFiles.Count -gt 0) { [void]$results.Add((Invoke-Check 'tests' $repoRoot (@('exec', 'vitest', 'related') + $sourceCliFiles + @('--run')))) }
        if ($plan -contains 'typecheck') {
            $buildInfo = Join-Path $stateRoot "tsconfig.tsbuildinfo"
            [void]$results.Add((Invoke-Check 'typecheck' $repoRoot @('exec', 'tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', $buildInfo)))
        }
        if ($plan -contains 'build') { [void]$results.Add((Invoke-Check 'build' $repoRoot @('run', 'build'))) }
    } finally { Pop-Location }

    $failed = @($results | Where-Object { $_.ExitCode -ne 0 })
    $lines = @("# Incremental quality", "", "- UTC: $([DateTime]::UtcNow.ToString('o'))", "- Fingerprint: $fingerprint", "- Changed files: $($changed.Count)")
    foreach ($result in $results) {
        $state = if ($result.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }
        $lines += "- $($result.Name): $state ($($result.Seconds)s)"
        if ($result.ExitCode -ne 0 -and $result.Output) { $lines += "  $($result.Output -replace "`r?`n", "`n  ")" }
    }
    [IO.File]::WriteAllText((Join-Path $stateRoot "quality-report.md"), (Protect-Text ($lines -join "`n")))
    [IO.File]::WriteAllText($fingerprintPath, $fingerprint)

    $summary = ($results | ForEach-Object { "$($_.Name)=" + $(if ($_.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }) }) -join ', '
    if ($failed.Count -gt 0) {
        Write-CompactJson @{ systemMessage = "Incremental quality checks failed: $summary"; hookSpecificOutput = @{ hookEventName = "PostToolUse"; additionalContext = "Incremental quality checks failed: $summary. Review the local report under the Git codex-hooks state directory." } }
    } else {
        Write-CompactJson @{ hookSpecificOutput = @{ hookEventName = "PostToolUse"; additionalContext = "Incremental quality checks completed: $summary" } }
    }
} finally {
    if ($null -ne $lock) { $lock.Dispose() }
}
