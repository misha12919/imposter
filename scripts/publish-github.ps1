# Публикация на GitHub и GitHub Pages
# 1. Выполните: gh auth login
# 2. Запустите: .\scripts\publish-github.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "Установите GitHub CLI: winget install GitHub.cli"
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Сначала войдите в GitHub:"
  gh auth login -h github.com -p https -w
}

$repoName = "imposter"
$user = (gh api user -q .login)
$remote = "https://github.com/$user/$repoName.git"

if (-not (git remote get-url origin 2>$null)) {
  gh repo create $repoName --public --source=. --remote=origin --description "Игра Шпион" 2>$null
  if ($LASTEXITCODE -ne 0) {
    git remote add origin $remote
  }
}

git push -u origin main

gh api -X PUT "repos/$user/$repoName/pages" -f "build_type=workflow" 2>$null
Write-Host ""
Write-Host "Готово. Сайт появится через 1-2 минуты:"
Write-Host "https://$user.github.io/$repoName/"
