# Unique meta descriptions for listings without a seller description

## Status: fixed and committed (2026-10-20); needs a production deploy and a re-crawl

## Problem

A site audit (2026-10-20, 158k pages) flagged **10 pages with duplicate meta descriptions**, all imported PG
listings, e.g. four in Marathahalli Village (Bengaluru), three in Dum Dum (Kolkata), three in Aundh (Pune).
Live output for all of them was `Contact for price — Single, Men in Marathahalli Village, Bengaluru.`

Cause (`generateMetadata` in `apps/web/src/app/[city]/[[...rest]]/page.tsx`): the description is
`{price} — {summary} in {area}, {city}.`, and `summary` is the seller's description or, when there is none, the specs
(`Single, Men`). Imported PGs have no description and "Contact for price", so every similar PG in an area produced
the same sentence — the listing's own name was not in it.

## Fix

When there is no seller-written description, the title leads:
`SLN Grand Gents PG: Contact for price — Single, Men in Marathahalli Village, Bengaluru.` A seller's own description
is used exactly as before (it already differs per listing). Truncation to 160 characters is unchanged and cuts the
end, so the title is never lost. Titles, canonicals, Open Graph/Twitter text (which reuse this description) and the
structured data are otherwise unchanged.

## Not fixed by this

Two listings with the **same name in the same area** still get identical text, because nothing else differs:
`SLN Grand Gents PG` appears twice in Marathahalli (ids `01ea2bb7…` and `1cb2e1a2…`). That is almost certainly the
same PG imported twice. It is a data problem rather than a template one: merge or deactivate one of each pair
(check the outreach/import source for duplicate Google place ids), then the audit item clears by itself.

## After deploy

Re-run the audit; the report only updates on the next crawl.
