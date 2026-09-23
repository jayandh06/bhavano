# Agent instructions (Cursor & others)

This repo mirrors Claude Code conventions under `.claude/` with Cursor-native rules under `.cursor/rules/`.

## Always apply

| Source | Cursor equivalent |
|--------|-------------------|
| [`CLAUDE.md`](CLAUDE.md) | [`/.cursor/rules/docs-plans.mdc`](.cursor/rules/docs-plans.mdc) + workspace rules |
| [`.claude/claude.md`](.claude/claude.md) | [`.cursor/rules/seo-and-routing.mdc`](.cursor/rules/seo-and-routing.mdc), [`.cursor/rules/url-consistency.mdc`](.cursor/rules/url-consistency.mdc) |

## Web app (`apps/web`)

When editing routes, layouts, or pages, the SEO and URL rules above apply automatically (file-scoped rules).

## Mobile app (`apps/mobile`)

- Read [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) for Expo-specific notes.
- Claude Code enables the official Expo plugin via [`apps/mobile/.claude/settings.json`](apps/mobile/.claude/settings.json). In Cursor, use Expo docs/skills when changing native or Expo config — there is no identical plugin toggle.

## Not agent rules (human setup only)

- [`.claude/SETUP.md`](.claude/SETUP.md) — Google Ads API credentials and OAuth (local `.env`, not committed).
- [`.claude/prompts.md`](.claude/prompts.md) — example Claude Code prompt templates for Ads workflows.

## Cursor setup checklist

1. Open this repo in Cursor — project rules load from `.cursor/rules/*.mdc`.
2. Optional: add user-level rules in Cursor Settings if you use personal conventions beyond this repo.
3. Before large features, search [`docs/plans/`](docs/plans/) and follow the plan doc workflow in `docs-plans.mdc`.
