#!/usr/bin/env node
import { GrowthStudioClient, createProductUrlPayload } from "./client.js";
import { getConfig, loadDotEnv } from "./config.js";
import { readJsonFile, runVideoJob } from "./jobs.js";

loadDotEnv();

const commands = new Set([
  "avatars",
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

  if (command === "upload-image") {
    const [filePath] = args;
    if (!filePath) throw new Error("upload-image requires a file path.");
    return (await client.uploadImage(filePath, { traceId: traceId("upload-image") })).body;
  }

  if (command === "create-from-url") {
    const [sourceUrl] = args;
    if (!sourceUrl) throw new Error("create-from-url requires a product URL.");
    return (await client.createVideo(createProductUrlPayload(sourceUrl), { traceId: traceId("create-video") })).body;
  }

  if (command === "create-from-json") {
    const [payloadPath] = args;
    if (!payloadPath) throw new Error("create-from-json requires a JSON payload path.");
    return (await client.createVideo(await readJsonFile(payloadPath), { traceId: traceId("create-video") })).body;
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

function parseListOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") options.limit = args[++index];
    else if (arg === "--status") options.status = args[++index];
    else if (arg === "--cursor") options.cursor = args[++index];
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
    if (arg === "--payload") options.payloadPath = args[++index];
    else if (arg === "--jobs-dir") options.jobsDir = args[++index];
    else if (arg === "--job-name") options.jobName = args[++index];
    else if (arg === "--timeout-minutes") options.timeoutMinutes = args[++index];
    else if (arg === "--initial-delay-seconds") options.initialDelaySeconds = args[++index];
    else if (arg === "--fallback-delay-seconds") options.fallbackDelaySeconds = args[++index];
    else if (arg === "--no-poll") options.poll = false;
    else throw new Error(`Unknown run-job option: ${arg}`);
  }
  return options;
}

function traceId(prefix) {
  return `${prefix}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
}

function printHelp() {
  console.log(`Usage:
  growth-studio avatars
  growth-studio upload-image /absolute/path/product.webp
  growth-studio create-from-url https://shop.example.com/products/item
  growth-studio create-from-json /absolute/path/payload.json
  growth-studio get <video_id>
  growth-studio poll <video_id>
  growth-studio list [--limit 20] [--status succeeded] [--cursor <cursor>]
  growth-studio edit <video_id> <clip_index> <instruction>
  growth-studio run-job --payload /absolute/path/payload.json [--jobs-dir jobs] [--job-name product-name] [--no-poll]`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
