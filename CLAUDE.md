# Working conventions for this repo

- **Plans live in `docs/plans/`, not only the external plan-mode scratch location.** When a plan
  (via plan mode) is finalized/approved, save a copy into `docs/plans/<descriptive-slug>.md` in this
  repo so it's tracked in git history alongside the code it describes, instead of only existing in
  the machine-local `~/.claude/plans/` directory.
- **Check `docs/plans/` before implementing or answering a prompt.** A relevant doc there often
  already has the design reasoning, rejected alternatives, and caveats behind a feature — read it
  first instead of re-deriving (or contradicting) decisions that were already made deliberately.
- **Update the relevant plan doc when an approved change actually lands.** If implemented behavior
  diverges from what a `docs/plans/` file describes — a field renamed, a flow reworked, a caveat
  resolved — update that doc in the same change so it stays a reliable account of the current
  design, not a stale record of the original one.
