/**
 * Fails a request that takes too long. React Native's `fetch` has no time limit of its own, so a request that stalls leaves its screen
 * loading for good, and React Query only tries again once something has failed. The stalled request is left to finish or not: only the
 * waiting ends.
 */
export function withTimeLimit<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The request took too long")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
