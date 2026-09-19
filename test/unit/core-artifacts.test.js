import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendJsonLineArtifact,
  createJobDirectory,
  readJsonArtifact,
  writeJsonArtifact,
} from "../../src/core/artifacts.js";

async function withTempDirectory(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-core-artifacts-"));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("createJobDirectory is exclusive", async () => withTempDirectory(async (root) => {
  const now = () => new Date("2026-09-18T12:34:56.000Z");
  const first = await createJobDirectory(root, { name: "My Job", now });
  assert.equal(path.basename(first), "2026-09-18T12-34-56-000Z-my-job");
  await assert.rejects(createJobDirectory(root, { name: "My Job", now }), /exist/i);
}));

test("writeJsonArtifact is atomic and refuses overwrite", async () => withTempDirectory(async (root) => {
  const file = path.join(root, "request.json");
  await writeJsonArtifact(file, { first: true }, { rootDir: root });
  await assert.rejects(writeJsonArtifact(file, { second: true }, { rootDir: root }), /already exists/i);
  assert.deepEqual(await readJsonArtifact(file, { rootDir: root }), { first: true });
  assert.deepEqual((await fs.readdir(root)).sort(), ["request.json"]);
}));

test("appendJsonLineArtifact appends immutable records", async () => withTempDirectory(async (root) => {
  const file = path.join(root, "polling.jsonl");
  const first = Object.freeze({ status: "pending" });
  await appendJsonLineArtifact(file, first, { rootDir: root });
  await appendJsonLineArtifact(file, { status: "done" }, { rootDir: root });
  const lines = (await fs.readFile(file, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(lines, [{ status: "pending" }, { status: "done" }]);
}));

test("artifact helpers reject traversal and symlink targets", async () => withTempDirectory(async (root) => {
  const outside = path.join(path.dirname(root), `${path.basename(root)}-outside.json`);
  await assert.rejects(writeJsonArtifact(outside, {}, { rootDir: root }), /outside artifact root/i);

  const real = path.join(root, "real.json");
  const link = path.join(root, "link.json");
  await fs.writeFile(real, "{}\n");
  await fs.symlink(real, link);
  await assert.rejects(readJsonArtifact(link, { rootDir: root }), /symbolic link/i);
}));
