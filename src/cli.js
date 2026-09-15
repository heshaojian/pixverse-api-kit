#!/usr/bin/env node
import { GrowthStudioClient, createProductUrlPayload } from "./client.js";
import { getConfig, loadDotEnv } from "./config.js";
import { resolveFolderForPayload } from "./folders.js";
import { readJsonFile, runVideoJob } from "./jobs.js";

loadDotEnv();

const commands = new Set([
  "avatars",
  "folders",
  "ensure-folder",
  "upload-image",
  "create-from-url",
  "create-from-json",
  "get",
  "poll",
  "list",
  "edit",
  "run-job",
]);

async function main(argv) {
  const [command, ...args] = argv;
  if (!commands.has(command)) {
    printHelp();
    process.exitCode = command ? 1 : 0;
    return;
  }

  const client = new GrowthStudioClient(getConfig());
  const result = await runCommand(client, command, args);
  console.log(JSON.stringify(result, null, 2));
}

async function runCommand(client, command, args) {
  if (command === "avatars") return (await client.listAvatars({ traceId: traceId("list-avatars") })).body;

  if (command === "folders") return (await client.listFolders({ traceId: traceId("list-folders") })).body;

  if (command === "ensure-folder") {
    const options = parseEnsureFolderOptions(args);
    if (!options.folderName) throw new Error("ensure-folder requires a folder name.");
    return await resolveFolderForPayload(client, {}, {
      folderName: options.folderName,
      traceId: traceId("ensure-folder"),
    });
  }

  if (command === "upload-image") {
    const [filePath] = args;
    if (!filePath) throw new Error("upload-image requires a file path.");
    return (await client.uploadImage(filePath, { traceId: traceId("upload-image") })).body;
  }

  if (command === "create-from-url") {
    const options = parseCreateFromUrlOptions(args);
    if (!options.sourceUrl) throw new Error("create-from-url requires a product URL.");
    const payload = createProductUrlPayload(options.sourceUrl);
    const prepared = await prepareCreatePayload(client, payload, options, traceId("create-video"));
    const result = (await client.createVideo(prepared.payload, { traceId: prepared.traceId })).body;
    return withFolderResult(result, prepared.folder);
  }

  if (command === "create-from-json") {
    const options = parseCreateFromJsonOptions(args);
    if (!options.payloadPath) throw new Error("create-from-json requires a JSON payload path.");
    const payload = await readJsonFile(options.payloadPath);
    const prepared = await prepareCreatePayload(client, payload, options, traceId("create-video"));
    const result = (await client.createVideo(prepared.payload, { traceId: prepared.traceId })).body;
    return withFolderResult(result, prepared.folder);
  }

  if (command === "get") {
    const [videoId] = args;
    return (await client.getVideo(videoId, { traceId: traceId("get-video") })).body;
  }

  if (command === "poll") {
    const [videoId] = args;
    return client.pollVideo(videoId, { traceId: traceId("poll-video") });
  }

  if (command === "list") {
    const options = parseListOptions(args);
    return (await client.listVideos({ ...options, traceId: traceId("list-videos") })).body;
  }

  if (command === "edit") {
    const [videoId, clipIndex, ...instructionParts] = args;
    const instruction = instructionParts.join(" ");
    return (await client.editVideo(
      videoId,
      { clip_index: Number(clipIndex), instruction },
      { traceId: traceId("edit-video") },
    )).body;
  }

  if (command === "run-job") {
    const options = parseRunJobOptions(args);
    if (!options.payloadPath) throw new Error("run-job requires --payload <path>.");
    return runVideoJob(client, await readJsonFile(options.payloadPath), {
      folderId: options.folderId,
      folderName: options.folderName,
      autoFolder: options.autoFolder,
      jobsDir: options.jobsDir,
      jobName: options.jobName,
      poll: options.poll,
      timeoutMs: options.timeoutMinutes ? Number(options.timeoutMinutes) * 60 * 1000 : undefined,
      initialDelaySeconds: options.initialDelaySeconds ? Number(options.initialDelaySeconds) : undefined,
      fallbackDelaySeconds: options.fallbackDelaySeconds ? Number(options.fallbackDelaySeconds) : undefined,
      traceId: traceId("job"),
    });
  }

  throw new Error(`Unknown command: ${command}`);
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

function parseCreateFromUrlOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--folder-id") options.folderId = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (arg === "--auto-folder") options.autoFolder = true;
    else if (!options.sourceUrl) options.sourceUrl = arg;
    else throw new Error(`Unknown create-from-url option: ${arg}`);
  }
  return options;
}

function parseCreateFromJsonOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--folder-id") options.folderId = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (arg === "--auto-folder") options.autoFolder = true;
    else if (!options.payloadPath) options.payloadPath = arg;
    else throw new Error(`Unknown create-from-json option: ${arg}`);
  }
  return options;
}

function parseEnsureFolderOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (!options.folderName) options.folderName = arg;
    else throw new Error(`Unknown ensure-folder option: ${arg}`);
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
    else throw new Error(`Unknown list option: ${arg}`);
  }
  return options;
}

function parseRunJobOptions(args) {
  const options = {
    poll: true,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--payload") options.payloadPath = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-id") options.folderId = readOptionValue(args, ++index, arg);
    else if (arg === "--folder-name") options.folderName = readOptionValue(args, ++index, arg);
    else if (arg === "--auto-folder") options.autoFolder = true;
    else if (arg === "--jobs-dir") options.jobsDir = readOptionValue(args, ++index, arg);
    else if (arg === "--job-name") options.jobName = readOptionValue(args, ++index, arg);
    else if (arg === "--timeout-minutes") options.timeoutMinutes = readOptionValue(args, ++index, arg);
    else if (arg === "--initial-delay-seconds") options.initialDelaySeconds = readOptionValue(args, ++index, arg);
    else if (arg === "--fallback-delay-seconds") options.fallbackDelaySeconds = readOptionValue(args, ++index, arg);
    else if (arg === "--no-poll") options.poll = false;
    else throw new Error(`Unknown run-job option: ${arg}`);
  }
  return options;
}

function readOptionValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${optionName} requires a value.`);
  return value;
}

function withFolderId(payload, folderId) {
  if (!folderId) return payload;
  return {
    ...payload,
    folder_id: folderId,
  };
}

function traceId(prefix) {
  return `${prefix}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
}

function printHelp() {
  console.log(`Usage:
  pixverse-api avatars
  pixverse-api folders
  pixverse-api ensure-folder <name>
  pixverse-api upload-image /absolute/path/product.webp
  pixverse-api create-from-url https://shop.example.com/products/item [--folder-id <folder_id> | --folder-name <name> | --auto-folder]
  pixverse-api create-from-json /absolute/path/payload.json [--folder-id <folder_id> | --folder-name <name> | --auto-folder]
  pixverse-api get <video_id>
  pixverse-api poll <video_id>
  pixverse-api list [--limit 20] [--status succeeded] [--cursor <cursor>]
  pixverse-api edit <video_id> <clip_index> <instruction>
  pixverse-api run-job --payload /absolute/path/payload.json [--folder-id <folder_id> | --folder-name <name> | --auto-folder] [--jobs-dir jobs] [--job-name product-name] [--no-poll]`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
