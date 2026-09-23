# Cursor setup (parity with `.claude/`)

Claude Code reads `.claude/claude.md` and root `CLAUDE.md` automatically. Cursor uses **Project Rules** in this folder instead.

## What was replicated

| Claude Code | Cursor |
|-------------|--------|
| `CLAUDE.md` (plans in `docs/plans/`) | `.cursor/rules/docs-plans.mdc` (`alwaysApply: true`) |
| `.claude/claude.md` (SEO) | `.cursor/rules/seo-and-routing.mdc` (`apps/web/**/*`) |
| `.claude/claude.md` (URLs) | `.cursor/rules/url-consistency.mdc` (`apps/web/**/*`) |
| — | [`AGENTS.md`](../AGENTS.md) (index for all agents) |

## What was not replicated (by design)

- **`.claude/SETUP.md`** — step-by-step Google Ads API setup; keep secrets in local `.env` only.
- **`.claude/prompts.md`** — copy/paste prompts for Claude Code Ads tutorials; optional reference for humans.
- **`apps/mobile/.claude/settings.json`** — Claude Code Expo plugin flag; use Cursor Expo/mobile docs when working under `apps/mobile/`.

## Verify rules are active

In Cursor: **Settings → Rules** (or open the Rules panel) and confirm project rules from `.cursor/rules/` appear for this workspace.

## Adding a new convention

Prefer a new focused `.mdc` file under `.cursor/rules/` (see Cursor “create rule” docs: YAML frontmatter with `description`, `globs`, and/or `alwaysApply`). Update [`AGENTS.md`](../AGENTS.md) if the mapping table should list it.
