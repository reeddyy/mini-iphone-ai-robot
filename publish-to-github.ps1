# Run in PowerShell: .\publish-to-github.ps1
# Creates/updates a PRIVATE GitHub repository after you authenticate with gh.
param(
  [string]$Repository = 'mini-iphone-ai-robot'
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Please install Git for Windows first: https://git-scm.com/downloads/win'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'Please install GitHub CLI first: https://cli.github.com/'
}
& gh auth status
if ($LASTEXITCODE -ne 0) {
  throw 'Run gh auth login to connect your GitHub account first.'
}

if (-not (Test-Path '.git')) {
  & git init -b main
  if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
}
& git add .
if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }

# Defensive check for environment files accidentally staged despite gitignore.
$staged = @(& git diff --cached --name-only)
$secrets = @($staged | Where-Object { $_ -match '(^|/)\.env($|\.)' -and $_ -notmatch '(^|/)\.env\.example$' })
if ((Get-Content .env.example -Raw) -match '(?m)^\s*ALIBABA_API_KEY\s*=\s*sk-[^\s#]+') {
  throw 'It looks like you placed a real API key in .env.example. Move it to .env before publishing.'
}
if ($secrets.Count -gt 0) {
  throw ('Refusing to publish secrets: ' + ($secrets -join ', '))
}

if ($staged.Count -gt 0) {
  & git commit -m 'Update Mini AI Robot prototype'
  if ($LASTEXITCODE -ne 0) {
    throw 'git commit failed. Configure git user.name and user.email, then retry.'
  }
}

# Checking remote names avoids treating the absence of 'origin' as an error.
$remotes = @(& git remote)
if ($remotes -contains 'origin') {
  & git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw 'Push failed. Check your GitHub access.' }
} else {
  & gh repo create $Repository --private --source . --remote origin --push
  if ($LASTEXITCODE -ne 0) { throw 'GitHub repo creation failed. Check your account and repository name.' }
}
Write-Host 'Published successfully. Open the GitHub URL printed above.'
