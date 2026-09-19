import path from "node:path";
import { GrowthStudioClient, createProductUrlPayload } from "./client.js";
import { getGrowthStudioConfig } from "./config.js";
import { resolveFolderForPayload } from "./folders.js";
import { readJsonFile, resumeGrowthStudioJob, runGrowthStudioJob } from "./jobs.js";

export const GROWTH_STUDIO_LEGACY_COMMAND_MAPPINGS = Object.freeze({
  avatars: ["avatars", "list"],
  folders: ["folders", "list"],
  "ensure-folder": ["folders", "ensure"],
  "upload-image": ["upload", "image"],
  "create-from-url": ["video", "create-from-url"],
  "create-from-json": ["video", "create-from-json"],
  get: ["video", "get"],
  poll: ["video", "poll"],
  list: ["video", "list"],
  edit: ["video", "edit"],
  "run-job": ["run-job"],
});

export async function runGrowthStudioCommand(args, context = {}) {
  const [resource, operation, ...rest] = args;
  let client;
  const getClient = () => {
    client ??= context.client || createClient(context);
    return client;
  };

  if (resource === "avatars" && operation === "list") {
    return (await getClient().listAvatars({ traceId: traceId("list-avatars") })).body;
  }
  if (resource === "folders" && operation === "list") {
    return (await getClient().listFolders({ traceId: traceId("list-folders") })).body;
  }
  if (resource === "folders" && operation === "ensure") {
    const options = parseEnsureFolderOptions(rest);
    if (!options.folderName) throw new Error("folders ensure requires a folder name.");
    return resolveFolderForPayload(getClient(), {}, {
      folderName: options.folderName,
      traceId: traceId("ensure-folder"),
    });
  }
  if (resource === "upload" && operation === "image") {
    const [filePath] = rest;
    if (!filePath) throw new Error("upload image requires a file path.");
    return (await getClient().uploadImage(filePath, { traceId: traceId("upload-image") })).body;
  }
  if (resource === "video" && operation === "create-from-url") {
    const options = parseCreateOptions(rest, "sourceUrl", "create-from-url");
    if (!options.sourceUrl) throw new Error("video create-from-url requires a product URL.");
    return createFromUrl(getClient(), options);
  }
  if (resource === "video" && operation === "create-from-json") {
    const options = parseCreateOptions(rest, "payloadPath", "create-from-json");
    if (!options.payloadPath) throw new Error("video create-from-json requires a JSON payload path.");
    return createFromJson(getClient(), options);
  }
  if (resource === "video" && (operation === "get" || operation === "status")) {
    const [videoId] = rest;
    return (await getClient().getVideo(videoId, { traceId: traceId("get-video") })).body;
  }
  if (resource === "video" && operation === "poll") {
    const [videoId] = rest;
    return getClient().pollVideo(videoId, { traceId: traceId("poll-video") });
  }
  if (resource === "video" && operation === "list") {
    const options = parseListOptions(rest);
    return (await getClient().listVideos({
      ...options,
      traceId: traceId("list-videos"),
    })).body;
  }
  if (resource === "video" && operation === "edit") {
    const [videoId, clipIndex, ...instructionParts] = rest;
    return (await getClient().editVideo(
      videoId,
      { clip_index: Number(clipIndex), instruction: instructionParts.join(" ") },
      { traceId: traceId("edit-video") },
    )).body;
  }
  if (resource === "run-job") {
    const options = parseRunJobOptions([operation, ...rest].filter((value) => value !== undefined));
    if (!options.payloadPath) throw new Error("run-job requires --payload <path>.");
    return runJob(getClient(), options);
  }
  if (resource === "resume") {
    const options = parseResumeOptions([operation, ...rest].filter((value) => value !== undefined));
    const jobDirectory = path.resolve(context.cwd ?? process.cwd(), options.jobDirectory);
    return (context.resumeGrowthStudioJob ?? resumeGrowthStudioJob)(getClient(), jobDirectory, options);
  }

  throw new Error(`Unknown Growth Studio command: ${args.join(" ")}`);
}

export function mapLegacyGrowthStudioCommand(command, args = []) {
  const mapped = GROWTH_STUDIO_LEGACY_COMMAND_MAPPINGS[command];
  if (!mapped) return null;
  return [...mapped, ...args];
}

export function getGrowthStudioHelp() {
  return `Usage:
  pixverse-api growth-studio avatars list
  pixverse-api growth-studio folders list
  pixverse-api growth-studio folders ensure <name>
  pixverse-api growth-studio upload image /absolute/path/product.webp
  pixverse-api growth-studio video create-from-url <url> [folder options]
  pixverse-api growth-studio video create-from-json <payload.json> [folder options]
  pixverse-api growth-studio video status <video_id>
  pixverse-api growth-studio video poll <video_id>
  pixverse-api growth-studio video list [--limit 20] [--status succeeded] [--cursor <cursor>]
  pixverse-api growth-studio video edit <video_id> <clip_index> <instruction>
  pixverse-api growth-studio run-job --payload <payload.json> [job options]
  pixverse-api growth-studio resume <job-directory> [polling options]`;
}

function createClient(context) {
  const options = { ...getGrowthStudioConfig(context.env) };
  if (context.fetchImpl) options.fetchImpl = context.fetchImpl;
  if (context.sleep) options.sleep = context.sleep;
  return new GrowthStudioClient(options);
}

async function createFromUrl(client, options) {
  const prepared = await prepareCreatePayload(
    client,
    createProductUrlPayload(options.sourceUrl),
    options,
    traceId("create-video"),
  );
  const result = (await client.createVideo(prepared.payload, { traceId: prepared.traceId })).body;
  return withFolderResult(result, prepared.folder);
}

async function createFromJson(client, options) {
  const prepared = await prepareCreatePayload(
    client,
    await readJsonFile(options.payloadPath),
    options,
    traceId("create-video"),
  );
  const result = (await client.createVideo(prepared.payload, { traceId: prepared.traceId })).body;
  return withFolderResult(result, prepared.folder);
}

async function runJob(client, options) {
  return runGrowthStudioJob(client, await readJsonFile(options.payloadPath), {
    folderId: options.folderId,
    folderName: options.folderName,
    autoFolder: options.autoFolder,
    jobsDir: options.jobsDir,
    jobName: options.jobName,
    poll: options.poll,
    timeoutMs: options.timeoutMinutes === undefined ? undefined : options.timeoutMinutes * 60 * 1000,
    initialDelaySeconds: options.initialDelaySeconds,
    fallbackDelaySeconds: options.fallbackDelaySeconds,
    traceId: traceId("job"),
  });
}

async function prepareCreatePayload(client, payload, options, createTraceId) {
  const folder = await resolveFolderForPayload(client, payload, {
    autoFolder: options.autoFolder,
    folderId: options.folderId,
    folderName: options.folderName,
    traceId: createTraceId,
  });
  return {
    folder,
    payload: withFolderId(payload, folder?.folderId),
    traceId: createTraceId,
  };
}

function withFolderResult(result, folder) {
  if (!folder) return result;
  return {
    ...result,
    folder_id: folder.folderId,
    folder_name: folder.folderName,
    folder_created: folder.folderCreated,
  };
}

function parseCreateOptions(args, positionalKey, command) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--folder-id") options.folderId = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (arg === "--auto-folder") options.autoFolder = true;
    else if (!options[positionalKey]) options[positionalKey] = arg;
    else throw new Error(`Unknown ${command} option: ${arg}`);
  }
  return options;
}

function parseEnsureFolderOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (!options.folderName) options.folderName = arg;
    else throw new Error(`Unknown folders ensure option: ${arg}`);
  }
  return options;
}

function parseListOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") options.limit = readOptionValue(args, ++index, arg);
    else if (arg === "--status") options.status = readOptionValue(args, ++index, arg);
    else if (arg === "--cursor") options.cursor = readOptionValue(args, ++index, arg);
    else throw new Error(`Unknown video list option: ${arg}`);
  }
  return options;
}

function parseRunJobOptions(args) {
  const options = { poll: true };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--payload") options.payloadPath = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-id") options.folderId = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (arg === "--auto-folder") options.autoFolder = true;
    else if (arg === "--jobs-dir") options.jobsDir = readOptionValue(args, ++index, arg);
    else if (arg === "--job-name") options.jobName = readOptionValue(args, ++index, arg);
    else if (arg === "--timeout-minutes") options.timeoutMinutes = readFiniteOption(args, ++index, arg, { minimum: 0, exclusive: true });
    else if (arg === "--initial-delay-seconds") options.initialDelaySeconds = readFiniteOption(args, ++index, arg, { minimum: 0 });
    else if (arg === "--fallback-delay-seconds") options.fallbackDelaySeconds = readFiniteOption(args, ++index, arg, { minimum: 0 });
    else if (arg === "--no-poll") options.poll = false;
    else throw new Error(`Unknown run-job option: ${arg}`);
  }
  return options;
}

function parseResumeOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--timeout-minutes") options.timeoutMs = readFiniteOption(args, ++index, arg, { minimum: 0, exclusive: true }) * 60 * 1000;
    else if (arg === "--initial-delay-seconds") options.initialDelaySeconds = readFiniteOption(args, ++index, arg, { minimum: 0 });
    else if (arg === "--fallback-delay-seconds") options.fallbackDelaySeconds = readFiniteOption(args, ++index, arg, { minimum: 0 });
    else if (arg.startsWith("--")) throw new Error(`Unknown resume option: ${arg}`);
    else if (!options.jobDirectory) options.jobDirectory = arg;
    else throw new Error("resume accepts exactly one job directory.");
  }
  if (!options.jobDirectory) throw new Error("resume requires a job directory.");
  return options;
}

function readOptionValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${optionName} requires a value.`);
  return value;
}

function readFiniteOption(args, index, optionName, constraints = {}) {
  const rawValue = readOptionValue(args, index, optionName);
  const value = Number(rawValue);
  const belowMinimum = constraints.exclusive
    ? value <= constraints.minimum
    : value < constraints.minimum;
  if (!Number.isFinite(value) || belowMinimum) {
    const comparison = constraints.exclusive ? "greater than" : "at least";
    throw new Error(`${optionName} must be a finite number ${comparison} ${constraints.minimum}.`);
  }
  return value;
}

function withFolderId(payload, folderId) {
  if (!folderId) return payload;
  return { ...payload, folder_id: folderId };
}

function traceId(prefix) {
  return `${prefix}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
}
