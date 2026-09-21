import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderProductDirectory } from "../deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");

const contentTypes = Object.freeze({
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
});

const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const collectLocalMediaPaths = async () => {
  const data = JSON.parse(await fs.readFile(path.join(pitchRoot, "data/cases.json"), "utf8"));
  const media = data.chapters.flatMap(({ cases }) =>
    cases.flatMap(({ inputs, attempts }) => [
      ...inputs,
      ...attempts.flatMap(({ media: items }) => items),
    ])
  );
  return [...new Set(media
    .map(({ url }) => url)
    .filter((url) => typeof url === "string" && !/^https:/i.test(url)))];
};

const createServer = () => http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
    const absolutePath = path.resolve(pitchRoot, relativePath);
    if (!absolutePath.startsWith(`${pitchRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const body = await fs.readFile(absolutePath);
    const contentType = contentTypes[path.extname(absolutePath).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType }).end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

test("VIPS pitch artifact is self-contained over static HTTP", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const requiredPaths = [
      "/",
      "/data/cases.json",
      "/styles.css",
      "/app.js",
      "/data-model.js",
      "/render.js",
      "/assets/brand/pixverse-logo.svg",
      "/assets/images/featured-presenter-poster.jpg",
      "/assets/images/featured-creative-poster.jpg",
      "/assets/images/featured-product-motion-poster.jpg",
      ...(await collectLocalMediaPaths()).map((assetPath) => `/${assetPath}`),
    ];

    for (const pathname of requiredPaths) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, pathname);
      const expectedType = contentTypes[path.extname(pathname).toLowerCase()] ?? "text/html";
      assert.match(response.headers.get("content-type") ?? "", new RegExp(escapeRegExp(expectedType)), pathname);
      await response.arrayBuffer();
    }

    const pageResponse = await fetch(`${baseUrl}/`);
    assert.equal(pageResponse.status, 200);
    const pageHtml = await pageResponse.text();
    assert.match(pageHtml, /id="workflow-selector"/);
    assert.match(pageHtml, /id="copy-pilot"/);
    assert.match(pageHtml, /id="ledger-retry"/);
    assert.match(pageHtml, /id="product-directory-mount"/);

    const data = JSON.parse(await fs.readFile(path.join(pitchRoot, "data/cases.json"), "utf8"));
    const directory = renderProductDirectory(data);
    assert.equal((directory.match(/class="product-directory-link"/g) ?? []).length, 10);
    assert.doesNotMatch(directory, /href="(?!https:\/\/detail\.vip\.com\/)/);

    const traversal = await fetch(`${baseUrl}/%2e%2e/package.json`);
    assert.notEqual(traversal.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
