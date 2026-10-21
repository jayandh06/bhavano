#Requires -Version 5.1
<#
.SYNOPSIS
  Pull latest git, build linux/arm64 images locally, scp to the app EC2, load + recreate containers.

.DESCRIPTION
  See docs/deployment.md -> "Local build -> copy images to app EC2" and "Windows (amd64 -> linux/arm64)".

  Required env (or -params):
    BHAVANO_EC2_HOST   - app Elastic IP / hostname
    BHAVANO_EC2_SSH_KEY - path to .pem / private key (optional if ssh-agent has it)

  Optional:
    BHAVANO_EC2_USER   - default ubuntu
    BHAVANO_REMOTE_DIR - default ~/bhavano
    BHAVANO_ENV_FILE   - default .env.prod.build (must contain NEXT_PUBLIC_* for web/admin builds)

.EXAMPLE
  $env:BHAVANO_EC2_HOST = "1.2.3.4"
  $env:BHAVANO_EC2_SSH_KEY = "$env:USERPROFILE\.ssh\bhavano-app.pem"
  .\scripts\deploy-local-to-ec2.ps1

.EXAMPLE
  .\scripts\deploy-local-to-ec2.ps1 -Services bff -SkipMigrate
#>
param(
  [string] $Ec2Host = $env:BHAVANO_EC2_HOST,
  [string] $Ec2User = $(if ($env:BHAVANO_EC2_USER) { $env:BHAVANO_EC2_USER } else { "ubuntu" }),
  [string] $SshKey = $env:BHAVANO_EC2_SSH_KEY,
  [string] $RemoteDir = $(if ($env:BHAVANO_REMOTE_DIR) { $env:BHAVANO_REMOTE_DIR } else { "~/bhavano" }),
  # Where the image tarballs are written (about 1-2 GB, twice: raw then gzipped). Defaults to the
  # repo root; point it at another drive when the repo's drive is full.
  [string] $WorkDir = $env:BHAVANO_WORK_DIR,
  [string] $EnvFile = $(if ($env:BHAVANO_ENV_FILE) { $env:BHAVANO_ENV_FILE } else { ".env.prod.build" }),
  # No [ValidateSet]/typed-array binding here on purpose — see the normalization block below for
  # why: `powershell -File` flattens a multi-value array argument (any syntax: @('web','admin'),
  # "web,admin", or bare space-separated tokens) down to just its first element before this param
  # block ever sees it, since the child process only receives a flat argv, and ValidateSet would
  # reject the comma-joined string this script now also accepts as a workaround.
  [string[]] $Services = @("web", "bff", "admin"),
  [switch] $SkipPull,
  [switch] $SkipMigrate,
  [switch] $BuildOnly,
  # Skip buildx/Compose and package the already-built :latest images instead.
  [switch] $ReuseImages,
  [string] $Platform = "linux/arm64",
  [string] $ProjectName = "bhavano",
  # Releases of each image left on the server after a deploy: the live one plus a rollback.
  [ValidateRange(1, 10)]
  [int] $KeepReleases = 2,
  # A bff image unpacks to about 1.3 GB; loading with less than this free risks a half-extracted
  # image. 2 (the old default) is also the exact floor video-upload.guard-rails.ts refuses uploads
  # at, so a deploy that left the disk at 2 GB left zero margin before a real user hit that error —
  # confirmed live 2026-09-30. 5 matches docs/deployment.md's/the prod-host runbook's own guidance.
  [ValidateRange(1, 20)]
  [int] $MinFreeGB = 5
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

# `powershell -File .\deploy-local-to-ec2.ps1 -Services @('web','admin')` (or any other multi-value
# syntax) silently collapses to a one-element array holding just "web" — confirmed directly:
# `-File` launches this script as a brand-new process, so PowerShell can only hand it a flat argv
# like any other external program, not the rich array object the caller typed. Splitting a single
# comma-joined element here (`-Services "web,admin"` also works) is the only form that survives
# that flattening, so it's accepted alongside the normal multi-argument form for an in-session call.
$Services = $Services | ForEach-Object { $_ -split "," } | Where-Object { $_ }
$validServices = @("web", "bff", "admin")
foreach ($svc in $Services) {
  if ($validServices -notcontains $svc) {
    throw "Invalid -Services value '$svc'. Valid values: $($validServices -join ', ')"
  }
}

function Require-Command([string] $Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Require-Command docker
Require-Command git
Require-Command scp
Require-Command ssh

if (-not $BuildOnly -and [string]::IsNullOrWhiteSpace($Ec2Host)) {
  throw "Set BHAVANO_EC2_HOST or pass -Ec2Host"
}
if (-not $ReuseImages -and -not (Test-Path $EnvFile)) {
  throw "Env file '$EnvFile' not found. Copy .env.production.example -> .env.prod.build and fill NEXT_PUBLIC_* (and other build args)."
}

$sshArgs = @()
if ($SshKey) {
  if (-not (Test-Path $SshKey)) { throw "SSH key not found: $SshKey" }
  $sshArgs += @("-i", $SshKey)
}
$sshArgs += @("-o", "StrictHostKeyChecking=accept-new")

$shortSha = (git rev-parse --short HEAD).Trim()
$TAG = "{0}_{1}" -f (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss"), $shortSha

Write-Host "==> Repo: $RepoRoot"
Write-Host "==> Services: $($Services -join ', ')"
Write-Host "==> Tag: $TAG"
Write-Host "==> Platform: $Platform"

if (-not $SkipPull -and -not $ReuseImages) {
  Write-Host "==> git pull --ff-only"
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "git pull failed" }
  $shortSha = (git rev-parse --short HEAD).Trim()
  $TAG = "{0}_{1}" -f (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss"), $shortSha
  Write-Host "==> Tag after pull: $TAG"
} elseif ($ReuseImages) {
  Write-Host "==> Reusing images from the current checkout; skipping git pull"
}

# Stable compose project name so local image names match what the EC2 checkout expects.
$env:COMPOSE_PROJECT_NAME = $ProjectName
if (-not $ReuseImages) {
  $env:DOCKER_DEFAULT_PLATFORM = $Platform

  Write-Host "==> Ensuring buildx builder (armbuilder)"
  # `buildx use` against the name directly, not a `buildx ls` text match: `ls`'s text output was
  # observed flaky under load on the .sh sibling script (2026-10-06 — the identical check against
  # identical builder state alternated found/not-found across back-to-back runs), which
  # intermittently tried to re-create a builder that already existed and aborted on Docker's own
  # "existing instance" error. No `2>&1` on this call either, same reason as before: under
  # $ErrorActionPreference = "Stop", redirecting native command's stderr into the success stream
  # wraps each stderr line in a NativeCommandError and throws — checking $LASTEXITCODE instead
  # avoids that regardless of which branch runs. See docs/deployment.md's own Windows gotchas for
  # the same issue at the outer invocation.
  docker buildx use armbuilder | Out-Null
  if ($LASTEXITCODE -ne 0) {
    docker buildx create --name armbuilder --driver docker-container --use | Out-Null
    docker buildx inspect --bootstrap | Out-Null
  }

  Write-Host "==> Building: $($Services -join ' ')"
  # Serial builds keep concurrent BuildKit/QEMU workers from exhausting Docker Desktop resources.
  docker compose -f docker-compose.prod.yml --env-file $EnvFile --parallel 1 build @Services
  if ($LASTEXITCODE -ne 0) { throw "docker compose build failed" }
} else {
  Write-Host "==> Reusing existing local images; skipping build"
}

$imageRefs = @()
foreach ($svc in $Services) {
  $localLatest = "${ProjectName}-${svc}:latest"
  $versioned = "${ProjectName}-${svc}:${TAG}"
  # Compose may use underscore on some setups - try hyphen first, then underscore.
  $found = docker images -q $localLatest
  if (-not $found) {
    $alt = "${ProjectName}_${svc}:latest"
    $found = docker images -q $alt
    if ($found) { $localLatest = $alt }
  }
  if (-not (docker images -q $localLatest)) {
    throw "Built image not found for service '$svc' (looked for ${ProjectName}-${svc}:latest). Run: docker images"
  }

  $arch = docker image inspect $localLatest --format "{{.Os}}/{{.Architecture}}"
  Write-Host "    $localLatest -> $arch"
  if ($arch -ne $Platform) {
    throw "Image $localLatest is '$arch', expected '$Platform'. Do not deploy - fix Buildx/platform."
  }

  docker tag $localLatest $versioned
  if ($LASTEXITCODE -ne 0) { throw "docker tag failed for $svc" }
  $imageRefs += $versioned
}

if ($BuildOnly) {
  Write-Host "==> BuildOnly set - images ready: $($imageRefs -join ', ')"
  Remove-Item Env:DOCKER_DEFAULT_PLATFORM -ErrorAction SilentlyContinue
  exit 0
}

$tarName = "bhavano-images-$TAG.tar.gz"
$tarDir = if ($WorkDir) { $WorkDir } else { $RepoRoot }
if (-not (Test-Path -LiteralPath $tarDir -PathType Container)) { New-Item -ItemType Directory -Path $tarDir | Out-Null }
$tarPath = Join-Path $tarDir $tarName
Write-Host "==> docker save -> $tarName"
$tarPlain = Join-Path $tarDir "bhavano-images-$TAG.tar"
docker save -o $tarPlain @imageRefs
if ($LASTEXITCODE -ne 0) { throw "docker save failed" }
if (-not (Test-Path -LiteralPath $tarPlain -PathType Leaf)) {
  throw "docker save reported success but did not create the archive: $tarPlain"
}

$inputStream = [System.IO.File]::OpenRead($tarPlain)
try {
  $outputStream = [System.IO.File]::Create($tarPath)
  try {
    $gzipStream = New-Object System.IO.Compression.GZipStream(
      $outputStream,
      [System.IO.Compression.CompressionMode]::Compress
    )
    try {
      $inputStream.CopyTo($gzipStream)
    } finally {
      $gzipStream.Dispose()
    }
  } finally {
    $outputStream.Dispose()
  }
} finally {
  $inputStream.Dispose()
}
if (-not (Test-Path -LiteralPath $tarPath -PathType Leaf)) {
  throw "Failed to create compressed archive: $tarPath"
}
# Windows can hold the freshly written .tar for a few seconds (antivirus / indexer scan). That must not
# abort a deploy whose archive is already built, so retry a few times and only warn if it stays locked.
for ($attempt = 1; $attempt -le 5; $attempt++) {
  try { Remove-Item -LiteralPath $tarPlain -ErrorAction Stop; break }
  catch {
    if ($attempt -eq 5) { Write-Warning "Could not delete $tarPlain (still in use); delete it by hand later." }
    else { Start-Sleep -Seconds 3 }
  }
}

$remote = "${Ec2User}@${Ec2Host}"
Write-Host "==> scp $tarName -> ${remote}:~/"
scp @sshArgs $tarPath "${remote}:~/$tarName"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

$svcList = ($Services -join " ")
$migrate = if ($SkipMigrate) { "false" } else { "true" }

$remoteScript = @"
set -euo pipefail
TAG='$TAG'
PROJECT='$ProjectName'
REMOTE_DIR='$RemoteDir'
# Single quotes above keep a leading ~ literal, so cd would look for a directory named "~".
REMOTE_DIR="`${REMOTE_DIR/#\~/`$HOME}"
TAR=~/$tarName
SERVICES='$svcList'
DO_MIGRATE='$migrate'
KEEP_RELEASES=$KeepReleases
MIN_FREE_KB=$($MinFreeGB * 1024 * 1024)

# Drops all but the newest KEEP_RELEASES timestamped tags of every app image. A tag still used by a
# running container only loses its name; the container keeps running.
prune_old_releases() {
  for svc in web bff admin; do
    docker images --format '{{.Tag}}' "`${PROJECT}-`${svc}" | grep -E '^[0-9]{14}_' | sort -r | \
      tail -n +`$((KEEP_RELEASES + 1)) | while read -r old; do
        docker rmi "`${PROJECT}-`${svc}:`${old}" >/dev/null && echo "    removed `${PROJECT}-`${svc}:`${old}"
      done || true
  done
  docker image prune -f >/dev/null || true
}

echo '==> git pull on EC2'
cd "`$REMOTE_DIR"
git pull --ff-only

echo '==> free disk before load'
prune_old_releases
FREE_KB=`$(df --output=avail -k / | tail -1)
echo "    `$((FREE_KB / 1024)) MB free"
# docker load can report success while failing to unpack layers on a full disk, and retagging
# :latest onto a half-extracted image breaks the next restart. Stop here instead.
if (( FREE_KB < MIN_FREE_KB )); then
  echo "Not enough disk on the server (need $MinFreeGB GB free). Nothing was changed." >&2
  rm -f "`$TAR"
  exit 1
fi

echo '==> docker load'
if [[ "`$TAR" == *.gz ]]; then
  gunzip -c "`$TAR" | docker load
else
  docker load -i "`$TAR"
fi

for svc in `$SERVICES; do
  # Creating a container needs every layer unpacked, so this catches a partial load before
  # :latest moves.
  probe=`$(docker create "`${PROJECT}-`${svc}:`${TAG}")
  docker rm "`$probe" >/dev/null
  docker tag "`${PROJECT}-`${svc}:`${TAG}" "`${PROJECT}-`${svc}:latest"
done

echo '==> compose up --no-build'
export COMPOSE_PROJECT_NAME=`$PROJECT
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build `$SERVICES

if [[ "`$DO_MIGRATE" == "true" ]] && echo "`$SERVICES" | grep -qw bff; then
  echo '==> prisma migrate deploy'
  # </dev/null: this script arrives on stdin, and the container would otherwise swallow the rest of it.
  docker compose -f docker-compose.prod.yml --env-file .env exec -T bff npx prisma migrate deploy </dev/null
fi

rm -f "`$TAR"

echo "==> keeping the newest `$KEEP_RELEASES releases of each image"
prune_old_releases
df -h / | tail -1

echo '==> done'
docker compose -f docker-compose.prod.yml ps
"@

# Sent as base64 of an LF-only script: this file is checked out with CRLF in some worktrees, and
# PowerShell adds CRLF to piped input, either of which leaves bash reading "pipefail\r".
$remoteB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($remoteScript -replace "`r", "")))

Write-Host "==> remote load + up --no-build"
ssh @sshArgs $remote "echo $remoteB64 | base64 -d | bash"
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }

Remove-Item Env:DOCKER_DEFAULT_PLATFORM -ErrorAction SilentlyContinue
Remove-Item $tarPath -ErrorAction SilentlyContinue
Remove-Item $tarPlain -ErrorAction SilentlyContinue
Remove-Item "$tarPlain.gz" -ErrorAction SilentlyContinue

Write-Host "==> Deploy finished ($TAG)"
