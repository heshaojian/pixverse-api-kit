#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { archiveCustomerPlugin, verifyManifest } from "./customer-plugin/archive.js";
import { customerPluginOutputDirectory, CUSTOMER_PLUGIN_RELEASE } from "./customer-plugin/config.js";
import { stageCustomerPlugin } from "./customer-plugin/stage.js";
import { verifyCustomerPlugin } from "./customer-plugin/verify.js";

const execFileAsync = promisify(execFile);

export async function buildCustomerPlugin({
  repoRoot,
  outputRoot = customerPluginOutputDirectory(repoRoot),
  installDependencies = true,
  pluginValidatorPath,
}) {
  const stagingParent = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-build-"));
  const extractionParent = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-extract-"));
  try {
    const staged = await stageCustomerPlugin({
      repoRoot,
      stageRoot: stagingParent,
      installDependencies,
    });
    const stagedVerification = await verifyCustomerPlugin({
      packageRoot: staged.packageRoot,
      pluginValidatorPath,
    });
    const archived = await archiveCustomerPlugin({
      packageRoot: staged.packageRoot,
      outputDir: outputRoot,
    });

    await execFileAsync("unzip", ["-q", archived.archivePath, "-d", extractionParent], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    const extractedPackageRoot = path.join(
      extractionParent,
      CUSTOMER_PLUGIN_RELEASE.archiveBaseName,
    );
    await verifyManifest(extractedPackageRoot);
    const extractedVerification = await verifyCustomerPlugin({
      packageRoot: extractedPackageRoot,
      pluginValidatorPath,
    });
    await updateReleaseReport(archived.reportPath, stagedVerification, extractedVerification);
    return archived;
  } finally {
    await Promise.all([
      fs.rm(stagingParent, { recursive: true, force: true }),
      fs.rm(extractionParent, { recursive: true, force: true }),
    ]);
  }
}

async function updateReleaseReport(reportPath, stagedVerification, extractedVerification) {
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const verificationChecks = [
    ...stagedVerification.checks.map(({ name }) => ({ name: `staged-${name}`, status: "passed" })),
    { name: "extracted-manifest", status: "passed" },
    ...extractedVerification.checks.map(({ name }) => ({ name: `extracted-${name}`, status: "passed" })),
  ];
  const updatedReport = {
    ...report,
    checks: [...report.checks, ...verificationChecks],
  };
  await fs.writeFile(reportPath, `${JSON.stringify(updatedReport, null, 2)}\n`);
}

function isExecutedDirectly() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  const repoRoot = process.cwd();
  const result = await buildCustomerPlugin({ repoRoot });
  process.stdout.write(`${result.archivePath}\n${result.checksumPath}\n${result.reportPath}\n`);
}
