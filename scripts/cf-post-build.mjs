// Runs after `opennextjs-cloudflare build` (see "cf:build" in package.json).
// Adds static-asset cache headers (Workers assets need a _headers file) and
// copies prerendered HTML pages to assets to bypass worker startup on static routes.
import { copyFileSync, existsSync } from "node:fs";

const target = ".open-next/assets";
if (!existsSync(target)) {
  console.error(`cf-post-build: ${target} not found - did opennextjs-cloudflare build fail?`);
  process.exit(1);
}
copyFileSync("cloudflare/_headers.txt", `${target}/_headers`);
console.log("cf-post-build: wrote .open-next/assets/_headers");

const homeHtml = ".next/server/app/index.html";
if (existsSync(homeHtml)) {
  copyFileSync(homeHtml, `${target}/index.html`);
  console.log("cf-post-build: wrote .open-next/assets/index.html (home page served without the Worker)");
} else {
  console.warn(`cf-post-build: ${homeHtml} not found - home page stays on the Worker`);
}

