$ErrorActionPreference = 'Stop'

$nodeHome = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Microsoft\VisualStudio\NodeJs'
$npmCmd = Join-Path $nodeHome 'npm.cmd'

if (-not (Test-Path $npmCmd)) {
  throw "npm.cmd not found at $npmCmd"
}

$env:Path = "$nodeHome;$env:Path"
Set-Location $PSScriptRoot

Write-Host '[backend] starting Nest dev server with local Node runtime...'
& $npmCmd run start:dev
