/**
 * Whether a User-Agent belongs to a crawler rather than a person.
 *
 * Shared between apps/web's middleware (which drops these before writing any Visit/PageView row
 * or touching a cookie) and the BFF's own AnalyticsService (which classifies whatever still
 * arrives, so a UA this list misses today can be found later rather than silently counted as a
 * human forever).
 *
 * Why this exists: crawlers discard cookies, so every request arrives with no `bhavano_sid` and
 * the middleware correctly writes a brand-new session for it — one Visit row per request,
 * forever. That is cookie-based grouping working exactly as designed on a client that throws the
 * cookie away, and it is not fixable by grouping differently (grouping by IP would be worse: on
 * Indian mobile carriers CGNAT puts thousands of unrelated real people behind one address). The
 * only real fix is not counting them. Measured before this existed: 165,202 of 165,450 visit
 * rows — 99.85% — had one page view or fewer, with seven sibling PetalBot IPs in
 * 114.119.128.0/18 contributing ~1,000 sessions each across ~950 distinct landing paths.
 *
 * Substring matching on a lowercased UA, deliberately: this is a display/analytics filter, not a
 * security control. A crawler that lies about its UA gets counted as a human, which is the same
 * outcome as before — no worse. Nothing about access is decided here.
 */
const BOT_UA_PATTERNS = [
  // Generic self-identifying tokens — the majority of well-behaved crawlers include one.
  'bot',
  'crawl',
  'spider',
  'slurp',
  'fetcher',
  'scraper',
  'archiver',
  // Named crawlers whose UA doesn't always carry a generic token above, or that are common
  // enough here to be worth naming for whoever reads this list next.
  'petalbot',
  'bytespider',
  'gptbot',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'ccbot',
  'perplexitybot',
  'ahrefs',
  'semrush',
  'mj12',
  'dotbot',
  'dataforseo',
  'serpstat',
  'seekport',
  'yandex',
  'baidu',
  'sogou',
  'facebookexternalhit',
  'embedly',
  'quora link preview',
  'headlesschrome',
  // Tooling/libraries — never a real visitor on a marketing site.
  'curl/',
  'wget',
  'python-requests',
  'httpx',
  'axios/',
  'go-http-client',
  'java/',
  'okhttp',
  'apache-httpclient',
  'libwww-perl',
  'lighthouse',
  'pagespeed',
  'gtmetrix',
  'uptime',
  'pingdom',
  'statuscake',
] as const;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}
