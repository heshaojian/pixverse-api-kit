import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempJobRoot(t, prefix = "pixverse-platform-jobs-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

export async function readJobArtifacts(jobDir) {
  const names = (await fs.readdir(jobDir)).sort();
  const artifacts = {};
  for (const name of names) {
    const contents = await fs.readFile(path.join(jobDir, name), "utf8");
    artifacts[name] = name.endsWith(".jsonl")
      ? contents.trim().split("\n").filter(Boolean).map(JSON.parse)
      : JSON.parse(contents);
  }
  return artifacts;
}
