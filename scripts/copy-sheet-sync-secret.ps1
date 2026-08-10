$ErrorActionPreference = "Stop"

$secretPath = Join-Path $env:LOCALAPPDATA "SIPI\sheet-sync-secret.xml"
if (-not (Test-Path -LiteralPath $secretPath)) {
  throw "Segredo local da sincronizacao nao encontrado."
}

$credential = Import-Clixml -LiteralPath $secretPath
$secret = $credential.GetNetworkCredential().Password
if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "O segredo local da sincronizacao esta vazio."
}

Set-Clipboard -Value $secret
Write-Host "Segredo copiado para a area de transferencia. Nenhum valor foi exibido."
