#!/usr/bin/env node
// Tells IndexNow search engines (Bing, Yandex and others; not Google) that URLs are new or changed, so they are
// crawled sooner. Run it AFTER the deploy that adds or changes the pages, since the engines fetch the key file from
// the live site to check the request is ours.
//
//   node scripts/indexnow-ping.mjs --dry-run            list what would be sent (default: the blog URLs in the sitemap)
//   node scripts/indexnow-ping.mjs                      send the blog URLs
//   node scripts/indexnow-ping.mjs --all                send every URL in the sitemap
//   node scripts/indexnow-ping.mjs <url> [<url> ...]    send exactly these URLs
//
// The key is the name of the 32-character .txt file in apps/web/public/ (its content is the same key). It is meant to
// be public. See docs/plans/blog-outreach-list.md.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.bhavano.com";
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "apps", "web", "public");

const keyFile = readdirSync(publicDir).find((name) => /^[a-f0-9]{32}\.txt$/.test(name));
if (!keyFile) {
  console.error("No IndexNow key file (32 hex characters + .txt) in apps/web/public/");
  process.exit(1);
}
const key = keyFile.replace(/\.txt$/, "");
if (readFileSync(join(publicDir, keyFile), "utf8").trim() !== key) {
  console.error("The key file's content must equal its file name.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const explicit = args.filter((a) => a.startsWith("http"));

async function sitemapUrls() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`Could not read the sitemap (${res.status})`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

const urls = explicit.length > 0 ? explicit : (await sitemapUrls()).filter((u) => all || u.includes("/blog/"));
if (urls.length === 0) {
  console.error("No URLs to send.");
  process.exit(1);
}

console.log(`${dryRun ? "Would send" : "Sending"} ${urls.length} URL(s); key file: ${SITE}/${keyFile}`);
if (dryRun) {
  for (const u of urls) console.log(" ", u);
  process.exit(0);
}

// The endpoint takes up to 10,000 URLs per call; send in batches of 500 to stay far below that.
for (let i = 0; i < urls.length; i += 500) {
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: "www.bhavano.com", key, keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(i, i + 500) }),
  });
  // 200 or 202 = accepted. 403 = the key file could not be verified (deploy it first). 422 = URLs not on this host.
  console.log(`batch ${i / 500 + 1}: HTTP ${res.status}`);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}
