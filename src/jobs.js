import fs from "node:fs/promises";
import path from "node:path";
import { resolveFolderForPayload } from "./folders.js";

const DEFAULT_JOBS_DIR = "jobs";

export async function runVideoJob(client, payload, options = {}) {
  const jobDir = await createJobDir(options.jobsDir || DEFAULT_JOBS_DIR, options.jobName);
  const traceBase = options.traceId || path.basename(jobDir);
  const folder = await resolveFolderForPayload(client, payload, {
    autoFolder: options.autoFolder,
    folderId: options.folderId,
    folderName: options.folderName,
    traceId: traceBase,
  });
  const createPayload = withFolderId(payload, folder?.folderId);

  if (folder) await writeJson(path.join(jobDir, "folder.json"), folder);

  await writeJson(path.join(jobDir, "request.json"), {
    trace_id: traceBase,
    created_at: new Date().toISOString(),
    payload: createPayload,
  });

  const createResult = await client.createVideo(createPayload, { traceId: `${traceBase}-create` });
  await writeJson(path.join(jobDir, "create-response.json"), createResult.body);

  const videoId = createResult.body.video_id;
  if (typeof videoId !== "string") {
    throw new Error("Create response did not include a string video_id.");
  }

  await writeJson(path.join(jobDir, "video-id.json"), { video_id: videoId });

  let final = createResult.body;
  if (options.poll !== false) {
    final = await client.pollVideo(videoId, {
      traceId: `${traceBase}-poll`,
      timeoutMs: options.timeoutMs,
      initialDelaySeconds: options.initialDelaySeconds,
      fallbackDelaySeconds: options.fallbackDelaySeconds,
      onSnapshot: async (snapshot) => {
        await appendJsonLine(path.join(jobDir, "polling.jsonl"), snapshot);
      },
    });
  }

  await writeJson(path.join(jobDir, "final.json"), final);

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

export async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function createJobDir(rootDir, jobName) {
  await fs.mkdir(rootDir, { recursive: true });
  const safeName = slugify(jobName || "pixverse-api-job");
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const jobDir = path.join(rootDir, `${stamp}-${safeName}`);
  await fs.mkdir(jobDir, { recursive: false });
  return jobDir;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function appendJsonLine(filePath, value) {
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "job";
}

function withFolderId(payload, folderId) {
  if (!folderId) return payload;
  return {
    ...payload,
    folder_id: folderId,
  };
}
