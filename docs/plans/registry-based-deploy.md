# Registry-based deploy: GitHub builds the images, the server pulls them

Status: written 6 Nov 2026. **Used for real deploys since 9 Nov** (web) and 14 Nov (bff and admin, `sha-0e65d4c2`, built from a branch, not master). The old script
(`scripts/deploy-local-to-ec2.ps1`) can be retired.

**Fixed 14 Nov 2026:** when the commit had no build yet and the script started one itself, it never found the run it had just started (the jq expression lost its
quotes under Windows PowerShell 5.1: "invalid token"). The run lookup is now filtered in PowerShell. Before the fix, the workaround was to watch the run with
`gh run watch <id>` and rerun the script, which then finds the finished build.

## Why

The old deploy built the three images on a Windows PC for `linux/arm64` under emulation, ran `docker save`, gzipped the archive, copied it to the server with
scp and `docker load`ed it. Slow steps: the emulated build, and moving the whole archive (about 300 MB to 1 GB) every time. It also needed Docker Desktop
running on the PC, which hung on 5 Nov 2026 and blocked a deploy. The Finfolia project instead builds in GitHub Actions and pushes to a registry, and the
server pulls only the layers that changed.

## How it works

1. `.github/workflows/build-images.yml` builds `bff`, `web` and `admin` for `linux/arm64` on GitHub's native ARM runners (`ubuntu-24.04-arm`, free for a public
   repository, no emulation) and pushes `ghcr.io/<owner>/bhavano-<service>:sha-<8 chars of the commit>` and `:latest`. It runs on every push to master that touches
   an app, `packages/` or the lockfile, and on demand (Actions > Build images > Run workflow, pick services and a branch). Layer caching is on (`type=gha`).
2. `scripts/deploy-from-registry.ps1` finds the build for your current commit (or `-Tag sha-xxxxxxxx`), starts and watches the workflow if that commit has no
   build yet, then over ssh: `git pull`, disk check (3 GB, `-MinFreeGB`), `docker pull`, architecture check, a `docker create` probe for a partial pull, retag as
   `bhavano-<service>:latest` and `bhavano-<service>:<timestamp>_<sha>` (the same naming the old script left, so pruning and rollback tags still work),
   `compose up -d --no-build`, optional `prisma migrate deploy`, prune to the newest two releases.
3. The compose file is unchanged: it still names `bhavano-<service>:latest` and runs with `--no-build`.

```powershell
.\scripts\deploy-from-registry.ps1 -Services bff -SkipMigrate        # the commit you are on
.\scripts\deploy-from-registry.ps1 -Tag sha-1a2b3c4d -SkipMigrate    # an earlier build (rollback)
```

## One-time setup (needs you)

1. **Merge this to master.** A workflow can only be started by hand once it exists on the default branch; merging also builds the first set of images.
2. **Build variables.** The web image bakes in five public values (`NEXT_PUBLIC_*`). Copy them from `.env.prod.build` into the repository's Actions variables with
   `.\scripts\set-github-build-vars.ps1` (needs `gh` signed in). Without them the web image is built with empty URLs.
3. **Let the server pull.** Either make the three packages public (GitHub profile > Packages > each `bhavano-*` > Package settings > Change visibility; the repo is
   public and the images hold no secrets, only the same public values the site ships to browsers), **or** on the server run once
   `echo <token> | docker login ghcr.io -u <user> --password-stdin` with a personal access token that has only `read:packages`.
4. First run: `.\scripts\deploy-from-registry.ps1 -Services bff -SkipMigrate`, check the site, then the other two.

## Differences and caveats

- The first push build has a cold cache, so it is slow; later builds reuse layers.
- A pull failing halfway leaves `:latest` untouched (the probe runs before retagging); the disk check runs first, as before.
- Server disk: this removes the tar upload, not the earlier finding that about 22 GB of the server's disk sits in Docker's containerd snapshots (cause unknown).
- Never build on the server (it took the site down on 14 Oct 2026); nothing here does.
- The images are built from the commit as pushed, not from your working tree: uncommitted changes are never deployed.
- If the ARM runner is unavailable (a private repo would need a paid larger runner), switch `runs-on` to `ubuntu-latest` and add QEMU
  (`docker/setup-qemu-action`): slower, but still off your PC.
