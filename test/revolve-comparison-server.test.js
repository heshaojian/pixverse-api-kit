import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createComparisonServer } from "../qa/revolve-v3-v4-comparison/server.js";

test("comparison server supports byte ranges for synchronized video seeking", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "revolve-comparison-"));
  const mediaDirectory = path.join(root, "pixverse-cli-jobs", "revolve-v3");
  await fs.mkdir(mediaDirectory, { recursive: true });
  await fs.writeFile(path.join(mediaDirectory, "sample.mp4"), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  await fs.writeFile(path.join(mediaDirectory, "video-result.json"), "{\"private\":true}");
  await fs.writeFile(path.join(root, ".env"), "PRIVATE_VALUE=do-not-serve");
  const server = createComparisonServer({ root });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(root, { recursive: true, force: true });
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/pixverse-cli-jobs/revolve-v3/sample.mp4`, {
    headers: { Range: "bytes=2-5" },
  });

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [2, 3, 4, 5]);

  const secretResponse = await fetch(`http://127.0.0.1:${address.port}/.env`);
  assert.equal(secretResponse.status, 404);

  const jobMetadataResponse = await fetch(`http://127.0.0.1:${address.port}/pixverse-cli-jobs/revolve-v3/video-result.json`);
  assert.equal(jobMetadataResponse.status, 404);

  const invalidRange = await fetch(`http://127.0.0.1:${address.port}/pixverse-cli-jobs/revolve-v3/sample.mp4`, {
    headers: { Range: "bytes=20-30" },
  });
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers.get("content-range"), "bytes */10");
});

test("comparison server rejects symlink escapes from an allowed media route", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "revolve-comparison-root-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "revolve-comparison-outside-"));
  const mediaDirectory = path.join(root, "pixverse-cli-jobs", "revolve-v4");
  await fs.mkdir(mediaDirectory, { recursive: true });
  await fs.writeFile(path.join(outside, "private.mp4"), "private");
  await fs.symlink(path.join(outside, "private.mp4"), path.join(mediaDirectory, "linked.mp4"));
  const server = createComparisonServer({ root });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await Promise.all([
      fs.rm(root, { recursive: true, force: true }),
      fs.rm(outside, { recursive: true, force: true }),
    ]);
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/pixverse-cli-jobs/revolve-v4/linked.mp4`);
  assert.equal(response.status, 403);
});
