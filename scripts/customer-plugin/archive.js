import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { CUSTOMER_PLUGIN_RELEASE } from "./config.js";
import { collectPackageEntries } from "./verify.js";

const execFileAsync = promisify(execFile);
const MANIFEST_NAME = "MANIFEST.sha256";

export async function archiveCustomerPlugin({ packageRoot, outputDir }) {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const resolvedOutputDir = path.resolve(outputDir);
  await fs.mkdir(resolvedOutputDir, { recursive: true });

  const manifestFiles = await writeManifest(resolvedPackageRoot);
  await normalizePackageTimestamps(resolvedPackageRoot);

  const archivePath = path.join(resolvedOutputDir, `${CUSTOMER_PLUGIN_RELEASE.archiveBaseName}.zip`);
  await fs.rm(archivePath, { force: true });
  const zipEntries = await collectZipEntries(resolvedPackageRoot);
  await execFileAsync("zip", ["-X", "-q", archivePath, ...zipEntries], {
    cwd: path.dirname(resolvedPackageRoot),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const archiveSha256 = await sha256File(archivePath);
  const checksumPath = `${archivePath}.sha256`;
  await fs.writeFile(checksumPath, `${archiveSha256}  ${path.basename(archivePath)}\n`);

  const reportPath = path.join(resolvedOutputDir, "release-report.json");
  const report = {
    release: {
      plugin: CUSTOMER_PLUGIN_RELEASE.pluginName,
      marketplace: CUSTOMER_PLUGIN_RELEASE.marketplaceName,
      version: CUSTOMER_PLUGIN_RELEASE.version,
      source_date: new Date(CUSTOMER_PLUGIN_RELEASE.sourceDateEpoch * 1000).toISOString(),
    },
    archive: {
      file: path.basename(archivePath),
      sha256: archiveSha256,
      file_count: manifestFiles.length,
    },
    checks: [
      { name: "deterministic-zip", status: "passed" },
      { name: "file-manifest", status: "passed" },
      { name: "archive-checksum", status: "passed" },
    ],
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  return Object.freeze({
    archivePath,
    checksumPath,
    reportPath,
    archiveSha256,
    files: Object.freeze(manifestFiles),
  });
}

export async function verifyManifest(packageRoot) {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const manifestPath = path.join(resolvedPackageRoot, MANIFEST_NAME);
  const rows = (await fs.readFile(manifestPath, "utf8")).split("\n").filter(Boolean);
  const records = rows.map((row) => {
    const match = /^([a-f0-9]{64})  ([^\n]+)$/.exec(row);
    if (!match) throw new Error("Package manifest contains an invalid row.");
    const relativePath = match[2];
    if (path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
      throw new Error(`Package manifest contains an unsafe path: ${relativePath}`);
    }
    return Object.freeze({ sha256: match[1], relativePath });
  });
  const uniquePaths = new Set(records.map(({ relativePath }) => relativePath));
  if (uniquePaths.size !== records.length) throw new Error("Package manifest contains duplicate paths.");

  const actualFiles = (await collectPackageEntries(resolvedPackageRoot))
    .filter(({ type, relativePath }) => type === "file" && relativePath !== MANIFEST_NAME)
    .map(({ relativePath }) => relativePath)
    .toSorted();
  const expectedFiles = records.map(({ relativePath }) => relativePath).toSorted();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error("Package manifest inventory does not match the extracted archive.");
  }
  for (const record of records) {
    const actual = await sha256File(path.join(resolvedPackageRoot, record.relativePath));
    if (actual !== record.sha256) throw new Error(`Package checksum mismatch: ${record.relativePath}`);
  }
  return Object.freeze({ status: "passed", files: Object.freeze(expectedFiles) });
}

async function writeManifest(packageRoot) {
  const files = (await collectPackageEntries(packageRoot))
    .filter(({ type, relativePath }) => type === "file" && relativePath !== MANIFEST_NAME)
    .map(({ relativePath }) => relativePath)
    .toSorted();
  const rows = await Promise.all(files.map(async (relativePath) => {
    const digest = await sha256File(path.join(packageRoot, relativePath));
    return `${digest}  ${relativePath}`;
  }));
  await fs.writeFile(path.join(packageRoot, MANIFEST_NAME), `${rows.join("\n")}\n`);
  return files;
}

async function normalizePackageTimestamps(packageRoot) {
  const timestamp = new Date(CUSTOMER_PLUGIN_RELEASE.sourceDateEpoch * 1000);
  const entries = await collectPackageEntries(packageRoot);
  for (const entry of entries.toSorted((left, right) => right.relativePath.length - left.relativePath.length)) {
    await fs.utimes(entry.fullPath, timestamp, timestamp);
  }
  await fs.utimes(packageRoot, timestamp, timestamp);
}

async function collectZipEntries(packageRoot) {
  const baseName = path.basename(packageRoot);
  const entries = await collectPackageEntries(packageRoot);
  return [
    `${baseName}/`,
    ...entries.map(({ relativePath, type }) => `${baseName}/${relativePath}${type === "directory" ? "/" : ""}`),
  ];
}

async function sha256File(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}
