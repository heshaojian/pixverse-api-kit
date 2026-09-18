import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const pageRoot = new URL("../deploy/brand-pitches/revolve/dev/", import.meta.url);
const catalogPath = new URL("catalog.json", pageRoot);

const readJson = async (url) => JSON.parse(await fs.readFile(url, "utf8"));

test("REVOLVE developer handoff exposes all approved products and jobs", async () => {
  const catalog = await readJson(catalogPath);

  assert.equal(catalog.products.length, 13);
  assert.equal(new Set(catalog.products.map(({ productId }) => productId)).size, 13);
  assert.ok(catalog.products.every(({ status }) => status === "approved"));
  assert.ok(catalog.products.every(({ productUrl }) => productUrl.startsWith("https://www.revolve.com/")));
  assert.ok(catalog.products.every(({ outputUrl }) => outputUrl.startsWith("https://media.pixverse.ai/")));
  assert.ok(catalog.products.every(({ jobs }) => jobs.video.url === `https://app.pixverse.ai/video/${jobs.video.id}`));
});

test("REVOLVE developer handoff includes reproducible prompts and public local records", async () => {
  const catalog = await readJson(catalogPath);

  assert.ok(catalog.products.every(({ prompts }) => prompts.video.length > 500));
  assert.ok(catalog.products.every(({ prompts }) => prompts.music.length > 20));
  assert.ok(catalog.products.every(({ source }) => source.promptUrl.startsWith("./records/")));
  assert.ok(catalog.products.every(({ source }) => source.requestUrl.startsWith("./records/")));
  assert.ok(catalog.products.every(({ source }) => source.commandUrl.startsWith("./records/")));
  assert.match(catalog.workflow.referenceCommand, /pixverse@latest[\s\S]*create reference/);
  assert.match(catalog.workflow.referenceCommand, /--workspace-id "\$PIXVERSE_WORKSPACE_ID"/);
  assert.match(catalog.workflow.referenceCommand, /--idempotency-key/);

  await Promise.all(catalog.products.flatMap(({ source }) => [
    fs.access(new URL(source.promptUrl, pageRoot)),
    fs.access(new URL(source.requestUrl, pageRoot)),
    fs.access(new URL(source.commandUrl, pageRoot)),
    fs.access(new URL(source.musicPromptUrl, pageRoot)),
  ]));
});

test("REVOLVE developer handoff is safe for a public static deployment", async () => {
  const files = await Promise.all(
    ["index.html", "styles.css", "app.js", "catalog.json", "_headers"].map((name) => fs.readFile(new URL(name, pageRoot), "utf8")),
  );
  const publicBundle = files.join("\n");

  assert.doesNotMatch(publicBundle, /mh_live_|PIXVERSE_API_KEY|Authorization:\s*Bearer|\/Users\/john|upload\/[0-9a-f-]+/i);
  assert.doesNotMatch(publicBundle, /workspace-id\s+425\d+/i);
  assert.doesNotMatch(publicBundle, /github\.com/i);
  assert.match(publicBundle, /X-Robots-Tag:\s*noindex, nofollow/);
});

test("REVOLVE developer handoff prioritizes outputs and remains responsive", async () => {
  const html = await fs.readFile(new URL("index.html", pageRoot), "utf8");
  const css = await fs.readFile(new URL("styles.css", pageRoot), "utf8");
  const script = await fs.readFile(new URL("app.js", pageRoot), "utf8");

  assert.match(html, /id="catalog"/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /id="product-template"/);
  assert.match(script, /preload = "none"/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /poster\.src = product\.posterUrl/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /aspect-ratio:\s*9\s*\/\s*16/);
  assert.match(css, /font-family:\s*"Plus Jakarta Sans"/);
  assert.match(css, /letter-spacing:\s*0/);
});
