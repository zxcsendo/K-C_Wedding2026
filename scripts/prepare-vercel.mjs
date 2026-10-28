/**
 * Builds dist/ for hosting.
 *
 * The repo deliberately keeps .env, .env.local and the guest-list backup, so a
 * host must never publish the repository as-is. This copies an allow-list of
 * files instead; anything not named here does not ship.
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(new URL(".", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), "..");
const OUT = join(ROOT, "dist");

const PAGES = [
  "index.html",
  "wedding.html",
  "wedding-rsvp.html",
  "wedding-ceremony.html",
  "wedding-gallery.html",
  "wedding-party.html",
  "wedding-faq.html",
  "admin.html",
  "invite.html",
];
const SCRIPTS = ["kc-admin-chip.js", "kc-patch.js"];
const ASSET_DIRS = ["images", "fonts", "audio"];
const FORBIDDEN = [".env", ".env.local", "convex", "node_modules", "package.json", "rsvp-backup-2026-10-23.json"];

// Keep .vercel/ (the project link) so a rebuild stays deployable with one
// command; everything else in dist/ is regenerated.
if (existsSync(OUT)) {
  for (const entry of readdirSync(OUT)) {
    if (entry === ".vercel") continue;
    rmSync(join(OUT, entry), { recursive: true, force: true });
  }
}
mkdirSync(OUT, { recursive: true });

for (const file of [...PAGES, ...SCRIPTS]) {
  cpSync(join(ROOT, file), join(OUT, file));
}
for (const dir of ASSET_DIRS) {
  cpSync(join(ROOT, dir), join(OUT, dir), { recursive: true });
}

// No package.json in dist/: the backend lives in Convex, and an npm manifest
// would make the host try to install and build this as a Node app.
writeFileSync(join(OUT, "robots.txt"), "User-agent: *\nDisallow: /admin.html\n");

// Dotfiles and dot-folders are tool state, and the host never serves them.
const walk = (dir, base = "") =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]));

const shipped = walk(OUT);
for (const path of shipped) {
  if (FORBIDDEN.includes(path)) throw new Error(`refusing to ship ${path}`);
}
// walk() ignores dotfiles, so the credential files get their own check.
for (const secret of [".env", ".env.local", ".env.production"]) {
  if (existsSync(join(OUT, secret))) throw new Error(`refusing to ship ${secret}`);
}

const bytes = shipped.reduce((n, f) => n + readFileSync(join(OUT, f)).length, 0);
console.log(`dist/ ready — ${shipped.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
