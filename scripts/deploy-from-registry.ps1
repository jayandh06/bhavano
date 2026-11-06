#Requires -Version 5.1
<#
.SYNOPSIS
  Deploys images that GitHub Actions already built (.github/workflows/build-images.yml): the server pulls only the layers it lacks, retags them
  as bhavano-<service>:latest and recreates the containers. Nothing is built or copied from this PC.

.DESCRIPTION
  Replaces scripts/deploy-local-to-ec2.ps1 (which builds linux/arm64 images under emulation here and scp's a tar file) once this one has deployed
  successfully. See docs/plans/registry-based-deploy.md for the one-time setup and rollback.

  Which build is deployed: the one for -Tag (sha-<8 chars>), else for the commit you are on (HEAD). If that commit has no successful build yet and
  -NoBuild is not set, the build workflow is started for it and watched. Requires: gh signed in, the commit pushed, the server logged in to ghcr.io
  (one time, see the doc), and BHAVANO_EC2_HOST / BHAVANO_EC2_SSH_KEY set as for the old script.

.EXAMPLE
  .\scripts\deploy-from-registry.ps1 -Services bff -SkipMigrate

.EXAMPLE
  # Roll back to an earlier build
  .\scripts\deploy-from-registry.ps1 -Tag sha-1a2b3c4d -SkipMigrate
#>
param(
  [string] $Ec2Host = $env:BHAVANO_EC2_HOST,
  [string] $Ec2User = $(if ($env:BHAVANO_EC2_USER) { $env:BHAVANO_EC2_USER } else { "ubuntu" }),
  [string] $SshKey = $env:BHAVANO_EC2_SSH_KEY,
  [string] $RemoteDir = $(if ($env:BHAVANO_REMOTE_DIR) { $env:BHAVANO_REMOTE_DIR } else { "~/bhavano" }),
  # Same comma-joined handling as the old script: `powershell -File` flattens a multi-value argument to its first element.
  [string[]] $Services = @("web", "bff", "admin"),
  [string] $Tag,
  [switch] $NoBuild,
  [switch] $SkipMigrate,
  [string] $ProjectName = "bhavano",
  # Releases of each image left on the server after a deploy: the live one plus a rollback.
  [ValidateRange(1, 10)]
  [int] $KeepReleases = 2,
  # A pull only adds the layers that changed, but a half-extracted image is as bad as with docker load, so keep a margin.
  [ValidateRange(1, 20)]
  [int] $MinFreeGB = 3
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$Services = $Services | ForEach-Object { $_ -split "," } | Where-Object { $_ }
$validServices = @("web", "bff", "admin")
foreach ($svc in $Services) {
  if ($validServices -notcontains $svc) { throw "Invalid -Services value '$svc'. Valid values: $($validServices -join ', ')" }
}
foreach ($cmd in @("git", "gh", "ssh")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Required command not found: $cmd" }
}
if ([string]::IsNullOrWhiteSpace($Ec2Host)) { throw "Set BHAVANO_EC2_HOST or pass -Ec2Host" }

$sshArgs = @()
if ($SshKey) {
  if (-not (Test-Path $SshKey)) { throw "SSH key not found: $SshKey" }
  $sshArgs += @("-i", $SshKey)
}
$sshArgs += @("-o", "StrictHostKeyChecking=accept-new")

$owner = ((gh repo view --json owner --jq ".owner.login") | Out-String).Trim().ToLower()
if (-not $owner) { throw "Could not read the repository owner (is gh signed in? gh auth status)" }
$registry = "ghcr.io/$owner"

# --- Which build -----------------------------------------------------------------------------------------------------
if (-not $Tag) {
  $sha = (git rev-parse HEAD).Trim()
  $Tag = "sha-" + $sha.Substring(0, 8)
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  Write-Host "==> Commit $($sha.Substring(0, 8)) on $branch -> tag $Tag"

  $built = gh run list --workflow build-images.yml --commit $sha --status success --json databaseId --jq ".[0].databaseId"
  if (-not $built) {
    if ($NoBuild) { throw "No successful image build for $Tag and -NoBuild is set. Push the commit and run the 'Build images' workflow, or pass -Tag." }
    git fetch origin --quiet
    $pushed = git branch -r --contains $sha
    if (-not $pushed) { throw "Commit $($sha.Substring(0, 8)) is not on GitHub. Push the branch first." }
    Write-Host "==> No build yet: starting 'Build images' on $branch for $($Services -join ', ')"
    $started = Get-Date
    gh workflow run build-images.yml --ref $branch -f services=($Services -join ",")
    if ($LASTEXITCODE -ne 0) { throw "Could not start the build workflow (is it on the default branch yet?)" }
    $runId = $null
    for ($i = 0; $i -lt 30 -and -not $runId; $i++) {
      Start-Sleep -Seconds 4
      $runId = gh run list --workflow build-images.yml --commit $sha --event workflow_dispatch --json databaseId,createdAt --jq "map(select(.createdAt >= `"$($started.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))`")) | .[0].databaseId"
    }
    if (-not $runId) { throw "The build run did not appear; check the Actions tab." }
    gh run watch $runId --exit-status
    if ($LASTEXITCODE -ne 0) { throw "Image build failed: gh run view $runId --log-failed" }
  } else {
    Write-Host "==> Build already done (run $built)"
  }
} else {
  Write-Host "==> Using tag $Tag"
}

$deployId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss") + "_" + ($Tag -replace "^sha-", "")
$svcList = ($Services -join " ")
$migrate = if ($SkipMigrate) { "false" } else { "true" }
$remote = "${Ec2User}@${Ec2Host}"

$remoteScript = @"
set -euo pipefail
TAG='$Tag'
DEPLOY_ID='$deployId'
REGISTRY='$registry'
PROJECT='$ProjectName'
REMOTE_DIR='$RemoteDir'
REMOTE_DIR="`${REMOTE_DIR/#\~/`$HOME}"
SERVICES='$svcList'
DO_MIGRATE='$migrate'
KEEP_RELEASES=$KeepReleases
MIN_FREE_KB=$($MinFreeGB * 1024 * 1024)

# Drops all but the newest KEEP_RELEASES timestamped tags of every app image (same naming as the old tar deploy, so rollback tags stay compatible).
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

echo '==> free disk before pull'
prune_old_releases
FREE_KB=`$(df --output=avail -k / | tail -1)
echo "    `$((FREE_KB / 1024)) MB free"
if (( FREE_KB < MIN_FREE_KB )); then
  echo "Not enough disk on the server (need $MinFreeGB GB free). Nothing was changed." >&2
  exit 1
fi

for svc in `$SERVICES; do
  echo "==> docker pull `${svc}"
  docker pull "`${REGISTRY}/`${PROJECT}-`${svc}:`${TAG}"
  arch=`$(docker image inspect "`${REGISTRY}/`${PROJECT}-`${svc}:`${TAG}" --format '{{.Os}}/{{.Architecture}}')
  if [[ "`$arch" != "linux/arm64" ]]; then echo "Image for `$svc is `$arch, expected linux/arm64. Not deploying." >&2; exit 1; fi
  # Creating a container needs every layer unpacked, so this catches a partial pull before :latest moves.
  probe=`$(docker create "`${REGISTRY}/`${PROJECT}-`${svc}:`${TAG}")
  docker rm "`$probe" >/dev/null
  docker tag "`${REGISTRY}/`${PROJECT}-`${svc}:`${TAG}" "`${PROJECT}-`${svc}:`${DEPLOY_ID}"
  docker tag "`${REGISTRY}/`${PROJECT}-`${svc}:`${TAG}" "`${PROJECT}-`${svc}:latest"
done

echo '==> compose up --no-build'
export COMPOSE_PROJECT_NAME=`$PROJECT
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build `$SERVICES

if [[ "`$DO_MIGRATE" == "true" ]] && echo "`$SERVICES" | grep -qw bff; then
  echo '==> prisma migrate deploy'
  # </dev/null: this script arrives on stdin, and the container would otherwise swallow the rest of it.
  docker compose -f docker-compose.prod.yml --env-file .env exec -T bff npx prisma migrate deploy </dev/null
fi

# The registry-tagged copies only duplicate names for the same layers; drop them so the next prune sees just the app tags.
for svc in `$SERVICES; do docker rmi "`${REGISTRY}/`${PROJECT}-`${svc}:`${TAG}" >/dev/null || true; done

echo "==> keeping the newest `$KEEP_RELEASES releases of each image"
prune_old_releases
df -h / | tail -1

echo '==> done'
docker compose -f docker-compose.prod.yml ps
"@

# Sent as base64 of an LF-only script (a CRLF checkout would leave bash reading "pipefail\r").
$remoteB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($remoteScript -replace "`r", "")))

Write-Host "==> remote pull + up --no-build"
ssh @sshArgs $remote "echo $remoteB64 | base64 -d | bash"
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }

Write-Host "==> Deploy finished ($deployId, $Tag)"
