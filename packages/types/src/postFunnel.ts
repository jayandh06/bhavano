/** One step of the `/post` posting-wizard funnel — see AdminService.getPostFunnel and
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Ordered: each step's
 * `sessions` is a subset of the previous one's (a session reaching Details necessarily reached
 * Category first), except `/post` itself, which can undercount slightly under an `entry`/
 * `loggedIn` filter — see that doc's own note on why. */
export interface PostFunnelStepDto {
  /** The real or synthetic PageView path this step counts — `/post`, `/post/category`, etc. */
  path: string;
  label: string;
  sessions: number;
  /** null for the first step, which has nothing to compare against. */
  pctOfPrevious: number | null;
}

export interface PostFunnelDto {
  steps: PostFunnelStepDto[];
}
