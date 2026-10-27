$ErrorActionPreference = "Continue"
Set-StrictMode -Version 2.0

function Write-CompactJson {
    param([hashtable]$Value)
    [Console]::Out.WriteLine(($Value | ConvertTo-Json -Depth 12 -Compress))
}

function Get-ToolCommand {
    param($Event)
    if ($null -eq $Event.tool_input) { return "" }
    if ($Event.tool_input -is [string]) { return [string]$Event.tool_input }
    if ($Event.tool_input.PSObject.Properties.Name -contains "command") { return [string]$Event.tool_input.command }
    if ($Event.tool_input.PSObject.Properties.Name -contains "cmd") { return [string]$Event.tool_input.cmd }
    return ""
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
    $exitCode = $LASTEXITCODE
    $path = $output | Select-Object -First 1
    if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($path)) { return $null }
    $path = $path.Trim()
    if (-not [IO.Path]::IsPathRooted($path)) { $path = Join-Path $RepoRoot $path }
    return [IO.Path]::GetFullPath($path)
}

function Protect-Text {
    param([string]$Text)
    if ($null -eq $Text) { return "" }
    $result = $Text
    $patterns = @(
        '(?i)\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b',
        '(?i)\bgh[pousr]_[A-Za-z0-9]{20,}\b',
        '(?i)\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}\b',
        '(?i)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        '(?im)^\s*[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|SERVICE_ROLE_KEY)\s*=\s*.+$'
    )
    foreach ($pattern in $patterns) { $result = [regex]::Replace($result, $pattern, '[REDACTED]') }
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

function Get-GitSummary {
    param([string]$RepoRoot)
    $branch = (& git -C $RepoRoot branch --show-current 2>$null | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "detached" } else { $branch = $branch.Trim() }
    $status = @(& git -C $RepoRoot status --porcelain=v1 --untracked-files=normal 2>$null)
    $conflicts = @(& git -C $RepoRoot diff --name-only --diff-filter=U 2>$null | Where-Object { $_ })
    $summary = "Git: branch=$branch; pending=$($status.Count); conflicts=$($conflicts.Count)"
    if ($conflicts.Count -gt 0) { $summary += "; conflict_files=" + (($conflicts | Select-Object -First 10) -join ', ') }
    return $summary
}

function Get-Hash {
    param([string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally { $sha.Dispose() }
}

function Test-StructuralChange {
    param([string]$ToolName, [string]$Command, [string[]]$Paths)
    if ($ToolName -eq "Bash") {
        return $Command -match '(?i)(?:^|[;&|]\s*)(?:pnpm|npm|yarn)\s+(?:install|add|remove|update)\b|\bgit\s+(?:merge|rebase|cherry-pick)\b|\b(?:codegen|generate)\b'
    }
    if ($Command -match '(?m)^\*\*\* Delete File:' -or ($Command -split "`n").Count -ge 300) { return $true }
    foreach ($path in $Paths) {
        if ($path -match '(?i)(?:^|/)(?:package\.json|pnpm-lock\.yaml|tsconfig[^/]*\.json|vite\.config\.[^/]+|eslint\.config\.[^/]+)$') { return $true }
        if ($path -match '(?i)^supabase/(?:migrations|functions|config\.toml)') { return $true }
        if ($path -match '(?i)^src/(?:routes?|router)(?:/|\.)') { return $true }
    }
    return $false
}

function Save-Checkpoint {
    param([string]$RepoRoot, [string]$SessionId, [string]$Reason, [string[]]$Paths)
    $checkpointRoot = Get-GitStoragePath $RepoRoot "codex-hooks/checkpoints"
    $stateRoot = Get-GitStoragePath $RepoRoot "codex-hooks/state"
    if (-not $checkpointRoot -or -not $stateRoot) { return $null }
    [void](New-Item -ItemType Directory -Force -Path $checkpointRoot)
    [void](New-Item -ItemType Directory -Force -Path $stateRoot)

    $status = (@(& git -C $RepoRoot status --porcelain=v1 --untracked-files=normal 2>$null) -join "`n")
    $diff = (@(& git -C $RepoRoot diff --binary HEAD -- 2>$null) -join "`n")
    $fingerprint = Get-Hash ($status + "`n" + $diff + "`n" + ($Paths -join "`n"))
    $safeSession = if ($SessionId) { $SessionId -replace '[^A-Za-z0-9_-]', '_' } else { "session" }
    $marker = Join-Path $stateRoot ("checkpoint-{0}.txt" -f $safeSession)
    if ((Test-Path -LiteralPath $marker) -and ((Get-Content -Raw -LiteralPath $marker).Trim() -eq $fingerprint)) { return $null }

    $stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
    $folder = Join-Path $checkpointRoot ("{0}-{1}-{2}" -f $stamp, $safeSession, $fingerprint.Substring(0, 10))
    [void](New-Item -ItemType Directory -Path $folder)
    [IO.File]::WriteAllText((Join-Path $folder "metadata.txt"), "created_utc=$([DateTime]::UtcNow.ToString('o'))`nreason=$Reason`nbranch=$((& git -C $RepoRoot branch --show-current 2>$null | Select-Object -First 1))`nfingerprint=$fingerprint`n")
    [IO.File]::WriteAllText((Join-Path $folder "status.txt"), (Protect-Text $status))
    [IO.File]::WriteAllText((Join-Path $folder "tracked.patch"), (Protect-Text $diff))

    $filesRoot = Join-Path $folder "files"
    foreach ($relative in $Paths) {
        $normalized = $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $source = [IO.Path]::GetFullPath((Join-Path $RepoRoot $normalized))
        if (-not $source.StartsWith($RepoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { continue }
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        if ([IO.Path]::GetFileName($source) -match '(?i)^\.env|\.(?:pem|p12|pfx|key)$') { continue }
        $destination = Join-Path $filesRoot $normalized
        [void](New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent))
        Copy-Item -LiteralPath $source -Destination $destination
    }
    [IO.File]::WriteAllText($marker, $fingerprint)
    return $folder
}

function Get-MigrationWarnings {
    param([string]$Patch, [string[]]$Paths)
    if (-not ($Paths | Where-Object { $_ -match '(?i)^supabase/migrations/.+\.sql$' })) { return @() }
    $warnings = New-Object System.Collections.Generic.List[string]
    $checks = @(
        @{ Pattern = '(?i)\bDROP\s+(?:TABLE|SCHEMA|TYPE)\b'; Label = 'DROP TABLE/SCHEMA/TYPE' },
        @{ Pattern = '(?i)\bTRUNCATE\b'; Label = 'TRUNCATE' },
        @{ Pattern = '(?i)\bALTER\s+TABLE\b[\s\S]{0,200}\bDROP\s+COLUMN\b'; Label = 'ALTER TABLE DROP COLUMN' },
        @{ Pattern = '(?i)\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b'; Label = 'DISABLE ROW LEVEL SECURITY' },
        @{ Pattern = '(?i)\bGRANT\b[\s\S]{0,160}\bTO\s+(?:anon|authenticated|public)\b'; Label = 'GRANT to broad application roles' },
        @{ Pattern = '(?i)\bDELETE\s+FROM\b(?![\s\S]{0,240}\bWHERE\b)'; Label = 'DELETE FROM without a nearby WHERE' }
    )
    foreach ($check in $checks) {
        if ($Patch -match $check.Pattern) { [void]$warnings.Add($check.Label) }
    }
    return @($warnings)
}

function Save-Continuity {
    param([string]$RepoRoot, [string]$LastMessage, [string]$EventName)
    $stateRoot = Get-GitStoragePath $RepoRoot "codex-hooks/state"
    if (-not $stateRoot) { return }
    [void](New-Item -ItemType Directory -Force -Path $stateRoot)
    $branch = (& git -C $RepoRoot branch --show-current 2>$null | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "detached" }
    $status = @(& git -C $RepoRoot status --short 2>$null | Select-Object -First 40)
    $conflicts = @(& git -C $RepoRoot diff --name-only --diff-filter=U 2>$null | Select-Object -First 20)
    $safeMessage = Protect-Text $LastMessage
    if ($safeMessage.Length -gt 1800) { $safeMessage = $safeMessage.Substring(0, 1800) + "..." }
    $qualityPath = Join-Path $stateRoot "quality-report.md"
    $quality = if (Test-Path -LiteralPath $qualityPath) { (Get-Content -Raw -LiteralPath $qualityPath) } else { "No incremental quality report yet." }
    if ($quality.Length -gt 1200) { $quality = $quality.Substring(0, 1200) + "..." }
    $content = @"
# Codex continuity (local, generated)

- Updated UTC: $([DateTime]::UtcNow.ToString('o'))
- Event: $EventName
- Branch: $branch
- Pending entries: $($status.Count)
- Conflicts: $($conflicts.Count)

## Working tree

$($status -join "`n")

## Latest assistant summary

$safeMessage

## Latest quality report

$(Protect-Text $quality)
"@
    [IO.File]::WriteAllText((Join-Path $stateRoot "continuity.md"), $content)
}

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
try { $event = $raw | ConvertFrom-Json } catch { [Console]::Error.WriteLine("Invalid hook JSON."); exit 1 }
$cwd = if ($event.PSObject.Properties.Name -contains "cwd") { [string]$event.cwd } else { (Get-Location).Path }
$repoRoot = Get-RepoRoot $cwd
if (-not $repoRoot) { exit 0 }
$eventName = [string]$event.hook_event_name

if ($eventName -eq "SessionStart") {
    $context = Get-GitSummary $repoRoot
    $stateRoot = Get-GitStoragePath $repoRoot "codex-hooks/state"
    $continuityPath = if ($stateRoot) { Join-Path $stateRoot "continuity.md" } else { $null }
    if ($continuityPath -and (Test-Path -LiteralPath $continuityPath)) {
        $continuity = Protect-Text (Get-Content -Raw -LiteralPath $continuityPath)
        if ($continuity.Length -gt 2200) { $continuity = $continuity.Substring(0, 2200) + "..." }
        $context += "`n`nContinuity:`n" + $continuity
    }
    Write-CompactJson @{ hookSpecificOutput = @{ hookEventName = "SessionStart"; additionalContext = $context } }
    exit 0
}

if ($eventName -eq "PreToolUse") {
    $toolName = [string]$event.tool_name
    $command = Get-ToolCommand $event
    $paths = if ($toolName -eq "apply_patch") { @(Get-PatchPaths $command) } else { @() }

    if ($toolName -eq "Bash" -and $command -match '(?i)\bsupabase(?:\.exe)?\s+(?:db\s+push|migration\s+up|functions\s+deploy|secrets\s+(?:set|unset)|projects?\s+delete)\b') {
        Write-CompactJson @{ hookSpecificOutput = @{ hookEventName = "PreToolUse"; permissionDecision = "deny"; permissionDecisionReason = "Remote Supabase mutation blocked. Ask for explicit human intervention and run it outside automatic hooks." } }
        exit 0
    }

    $sessionId = if ($event.PSObject.Properties.Name -contains "session_id") { [string]$event.session_id } else { "session" }
    if (Test-StructuralChange $toolName $command $paths) {
        $reason = if ($toolName -eq "apply_patch") { "structural patch: " + ($paths -join ', ') } else { "structural command" }
        [void](Save-Checkpoint $repoRoot $sessionId $reason $paths)
    }

    if ($toolName -eq "Bash" -and $command -match '(?i)(?:^|[;&|]\s*)git\s+(?:commit|merge|rebase|cherry-pick|push|pull|checkout|switch|reset|clean)\b') {
        $summary = Get-GitSummary $repoRoot
        $conflicts = @(& git -C $repoRoot diff --name-only --diff-filter=U 2>$null | Where-Object { $_ })
        if ($conflicts.Count -gt 0 -and $command -match '(?i)\bgit\s+(?:commit|push|merge|rebase|cherry-pick)\b') {
            Write-CompactJson @{ hookSpecificOutput = @{ hookEventName = "PreToolUse"; permissionDecision = "deny"; permissionDecisionReason = "Unresolved Git conflicts detected. Resolve them before this operation. $summary" } }
        } else {
            Write-CompactJson @{ hookSpecificOutput = @{ hookEventName = "PreToolUse"; additionalContext = $summary } }
        }
    }
    exit 0
}

if ($eventName -eq "PostToolUse" -and [string]$event.tool_name -eq "apply_patch") {
    $command = Get-ToolCommand $event
    $paths = @(Get-PatchPaths $command)
    $warnings = @(Get-MigrationWarnings $command $paths)
    if ($warnings.Count -gt 0) {
        $message = "Supabase migration review required: " + ($warnings -join '; ') + ". No remote migration was executed."
        Write-CompactJson @{ systemMessage = $message; hookSpecificOutput = @{ hookEventName = "PostToolUse"; additionalContext = $message } }
    }
    exit 0
}

if ($eventName -in @("Stop", "PreCompact", "SessionEnd")) {
    $lastMessage = if ($event.PSObject.Properties.Name -contains "last_assistant_message" -and $null -ne $event.last_assistant_message) { [string]$event.last_assistant_message } else { "" }
    Save-Continuity $repoRoot $lastMessage $eventName
    if ($eventName -in @("Stop", "PreCompact")) { Write-CompactJson @{} }
    exit 0
}

exit 0
