import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
const deployReadme = path.join(repoRoot, "deploy/brand-pitches/README.md");
const docsReadme = path.join(repoRoot, "docs/brand-pitches/README.md");
const expectedHeaders = `/*
  X-Robots-Tag: noindex, nofollow
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; media-src 'self' https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
`;

const textExtensions = new Set([".html", ".css", ".js", ".json", ".svg", ".md", ".txt", ""]);

const collectTextFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(absolute));
    } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolute);
    }
  }
  return files;
};

test("VIPS private preview ships strict noindex security headers", async () => {
  const headers = await fs.readFile(path.join(pitchRoot, "_headers"), "utf8");
  assert.equal(headers, expectedHeaders);
});

test("VIPS private pitch text excludes secrets, internals, and active distribution hooks", async () => {
  const forbidden = /YEE4dcLZAoiZC9x9vhzcZKLknsc|file_token|\/Users\/|mh_live_|API[-_ ]?KEY|Bearer\s+[A-Za-z0-9._-]+|(?:job|asset|video)[_-]?id\b|analytics|gtag|segment\.com|http:\/\/(?!www\.w3\.org\/2000\/svg)|javascript:|data:text\/html|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  for (const filePath of await collectTextFiles(pitchRoot)) {
    const relativePath = path.relative(pitchRoot, filePath);
    const text = await fs.readFile(filePath, "utf8");
    assert.doesNotMatch(text, forbidden, relativePath);
  }
});

test("VIPS private pitch is documented as local-only and unreleased", async () => {
  const [deployText, docsText] = await Promise.all([
    fs.readFile(deployReadme, "utf8"),
    fs.readFile(docsReadme, "utf8"),
  ]);
  assert.match(deployText, /vips\/human-reviewed-ecommerce\//);
  assert.match(deployText, /private local preview/i);
  assert.match(deployText, /public deployment, external distribution, analytics, and asset uploads remain unapproved/i);
  assert.match(docsText, /2026-09-20-vips-human-reviewed-pitch-design\.md/);
  assert.match(docsText, /2026-09-20-vips-human-reviewed-pitch\.md/);
});
