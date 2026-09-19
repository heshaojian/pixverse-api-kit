import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function createJobDirectory(rootDir, options = {}) {
  await fs.mkdir(rootDir, { recursive: true });
  await rejectSymlink(rootDir);
  const timestamp = toDate(options.now?.() ?? new Date()).toISOString().replaceAll(/[:.]/g, "-");
  const jobDirectory = path.join(rootDir, `${timestamp}-${slugify(options.name ?? "pixverse-api-job")}`);
  await assertWithinRoot(rootDir, jobDirectory);
  await fs.mkdir(jobDirectory, { recursive: false, mode: 0o700 });
  return jobDirectory;
}

export async function writeJsonArtifact(filePath, value, options = {}) {
  const rootDir = options.rootDir ?? path.dirname(filePath);
  await assertSafeArtifactPath(rootDir, filePath, { allowMissingTarget: true });

  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let temporaryHandle;
  try {
    temporaryHandle = await fs.open(temporaryPath, "wx", 0o600);
    await temporaryHandle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await temporaryHandle.sync();
    await temporaryHandle.close();
    temporaryHandle = undefined;

    await fs.link(temporaryPath, filePath).catch((error) => {
      if (error?.code === "EEXIST") throw new Error(`Artifact already exists: ${filePath}`);
      throw error;
    });
    await fs.unlink(temporaryPath);
  } catch (error) {
    await temporaryHandle?.close().catch(() => {});
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function appendJsonLineArtifact(filePath, value, options = {}) {
  const rootDir = options.rootDir ?? path.dirname(filePath);
  await assertSafeArtifactPath(rootDir, filePath, { allowMissingTarget: true });
  const handle = await fs.open(filePath, "a", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readJsonArtifact(filePath, options = {}) {
  const rootDir = options.rootDir ?? path.dirname(filePath);
  await assertSafeArtifactPath(rootDir, filePath);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function assertSafeArtifactPath(rootDir, filePath, options = {}) {
  const root = await assertWithinRoot(rootDir, filePath);
  await rejectSymlink(root);

  const relative = path.relative(root, path.resolve(filePath));
  const segments = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    try {
      await rejectSymlink(current);
    } catch (error) {
      if (error?.code === "ENOENT" && options.allowMissingTarget && index === segments.length - 1) return;
      throw error;
    }
  }
}

async function assertWithinRoot(rootDir, filePath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(filePath);
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Artifact path is outside artifact root: ${filePath}`);
  }
  return root;
}

async function rejectSymlink(filePath) {
  const stats = await fs.lstat(filePath);
  if (stats.isSymbolicLink()) throw new Error(`Artifact path contains a symbolic link: ${filePath}`);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "job";
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}
