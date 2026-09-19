import fs from "node:fs/promises";
import path from "node:path";
import {
  appendJsonLineArtifact,
  createJobDirectory,
  readJsonArtifact,
  writeJsonArtifact,
} from "../core/artifacts.js";
import { serializeError } from "../core/errors.js";
import { redact } from "../core/redaction.js";
import { resolveFolderForPayload } from "./folders.js";

const DEFAULT_JOBS_DIR = "jobs";

export async function runVideoJob(client, payload, options = {}) {
  const jobDir = await createJobDir(options.jobsDir || DEFAULT_JOBS_DIR, options.jobName);
  const traceBase = options.traceId || path.basename(jobDir);
  try {
    const folder = await resolveFolderForPayload(client, payload, {
      autoFolder: options.autoFolder,
      folderId: options.folderId,
      folderName: options.folderName,
      traceId: traceBase,
    });
    const createPayload = withFolderId(payload, folder?.folderId);

    if (folder) await writeArtifact(jobDir, "folder.json", redact(folder));

    await writeArtifact(jobDir, "request.json", redact({
      provider: "growth-studio",
      trace_id: traceBase,
      created_at: new Date().toISOString(),
      payload: createPayload,
    }));

    const createResult = await client.createVideo(createPayload, { traceId: `${traceBase}-create` });
    await writeArtifact(jobDir, "create-response.json", redact(createResult.body));

    const videoId = createResult.body.video_id;
    if (typeof videoId !== "string" || videoId === "") {
      throw new Error("Create response did not include a string video_id.");
    }

    await writeArtifact(jobDir, "video-id.json", { video_id: videoId });

    const final = options.poll === false
      ? createResult.body
      : await pollKnownVideo(client, jobDir, videoId, traceBase, options);

    if (options.poll === false) await writeArtifact(jobDir, "final.json", redact(final));

    return resultFromFinal(jobDir, videoId, final, folder);
  } catch (error) {
    await persistFailure(jobDir, error, traceBase);
    throw error;
  }
}

export const runGrowthStudioJob = runVideoJob;

export async function resumeGrowthStudioJob(client, jobDirectory, options = {}) {
  const jobDir = path.resolve(jobDirectory);
  const request = await readJsonArtifact(path.join(jobDir, "request.json"), { rootDir: jobDir });
  const completed = await readOptionalArtifact(jobDir, "final.json");
  if (completed && isTerminal(completed.status)) {
    const id = (await readOptionalArtifact(jobDir, "video-id.json"))?.video_id;
    return resultFromFinal(jobDir, id, completed);
  }

  const videoId = (await readOptionalArtifact(jobDir, "video-id.json"))?.video_id;
  if (typeof videoId !== "string" || videoId === "") {
    return {
      provider: "growth-studio",
      trace_id: request.trace_id,
      job_dir: jobDir,
      status: "reconciliation_required",
      retryable: false,
    };
  }

  if (completed) await archivePriorFinal(jobDir);

  try {
    const final = await pollKnownVideo(client, jobDir, videoId, request.trace_id, options);
    return resultFromFinal(jobDir, videoId, final);
  } catch (error) {
    await persistFailure(jobDir, error, request.trace_id, { preserveExisting: true });
    throw error;
  }
}

export async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function createJobDir(rootDir, jobName) {
  return createJobDirectory(path.resolve(rootDir), { name: jobName || "pixverse-api-job" });
}

async function pollKnownVideo(client, jobDir, videoId, traceBase, options) {
  const final = await client.pollVideo(videoId, {
    traceId: `${traceBase}-poll`,
    timeoutMs: options.timeoutMs,
    initialDelaySeconds: options.initialDelaySeconds,
    fallbackDelaySeconds: options.fallbackDelaySeconds,
    onSnapshot: async (snapshot) => {
      await appendJsonLineArtifact(path.join(jobDir, "polling.jsonl"), redact(snapshot), { rootDir: jobDir });
    },
  });
  await writeArtifact(jobDir, "final.json", redact(final));
  return final;
}

function resultFromFinal(jobDir, videoId, final, folder) {
  return {
    job_dir: jobDir,
    video_id: videoId,
    status: final.status,
    video_url: final.output?.video_url,
    thumbnail_url: final.output?.thumbnail_url,
    request_id: final.request_id,
    folder_id: folder?.folderId,
    folder_name: folder?.folderName,
  };
}

async function writeArtifact(jobDir, name, value) {
  await writeJsonArtifact(path.join(jobDir, name), value, { rootDir: jobDir });
}

async function readOptionalArtifact(jobDir, name) {
  try {
    return await readJsonArtifact(path.join(jobDir, name), { rootDir: jobDir });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeArtifactIfMissing(jobDir, name, value) {
  if (await readOptionalArtifact(jobDir, name)) return;
  await writeArtifact(jobDir, name, value);
}

async function persistFailure(jobDir, error, traceId, options = {}) {
  if (options.preserveExisting) await archivePriorArtifact(jobDir, "error.json", "error-prior");
  const publicError = serializeError(error);
  await writeArtifactIfMissing(jobDir, "error.json", redact({
    name: publicError.name,
    message: "Growth Studio job failed. Inspect saved artifacts before recovery.",
    category: publicError.category ?? (error instanceof TypeError ? "transport" : "unknown"),
    provider: "growth-studio",
    ...(publicError.status === undefined ? {} : { status: publicError.status }),
    ...(publicError.code === undefined ? {} : { code: publicError.code }),
    ...(publicError.retryable === undefined ? {} : { retryable: publicError.retryable }),
    ...(publicError.retry_after === undefined ? {} : { retry_after: publicError.retry_after }),
    trace_id: publicError.trace_id ?? traceId,
  }));
}

async function archivePriorFinal(jobDir) {
  await archivePriorArtifact(jobDir, "final.json", "final-prior");
}

async function archivePriorArtifact(jobDir, sourceName, targetPrefix) {
  const source = path.join(jobDir, sourceName);
  for (let index = 1; index < Number.MAX_SAFE_INTEGER; index += 1) {
    const target = path.join(jobDir, `${targetPrefix}-${index}.json`);
    try {
      await fs.link(source, target);
      await fs.unlink(source);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Could not preserve the prior Growth Studio ${sourceName} artifact.`);
}

function isTerminal(status) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function withFolderId(payload, folderId) {
  if (!folderId) return payload;
  return {
    ...payload,
    folder_id: folderId,
  };
}
