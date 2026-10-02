/**
 * Runs `fn` over `items` with at most `limit` in flight at once, preserving input order in the
 * returned array regardless of which one finishes first — a `for` loop that awaits each item
 * before starting the next is correct but serializes work that's actually independent (e.g.
 * uploading several files), which is slow for no reason when the caller can tolerate a few
 * requests in flight together. See docs/plans/posting-speed-and-progress.md, the first user of
 * this, for why: sequential photo/video upload was the dominant cost in ad-posting wall-clock
 * time, with server-side processing already decoupled from it.
 *
 * Plain and dependency-free on purpose — small enough not to need a package, and this needs to be
 * importable from both a Next.js web app and a React Native app with no DOM/RN-specific API.
 *
 * `fn` is responsible for its own error handling if a caller wants to continue past a failure
 * (video uploads do); letting an error propagate out of `fn` rejects the whole `Promise.all` the
 * way `Promise.all` normally does, same as it would for a caller's own hand-rolled loop.
 */
export declare function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
