import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const FFPROBE_ARGS = [
  "-v", "error",
  "-show_entries", "format=duration,size:stream=codec_type,width,height",
  "-of", "json",
];

export async function inspectLocalMedia(filePath, options = {}) {
  const stats = await fs.lstat(filePath);
  if (stats.isSymbolicLink()) throw new Error(`Media path must not be a symbolic link: ${filePath}`);
  if (!stats.isFile()) throw new Error(`Media path must be a regular file: ${filePath}`);
  if (options.maxBytes !== undefined && stats.size > options.maxBytes) {
    throw new Error(`Media file exceeds maximum size of ${options.maxBytes} bytes.`);
  }
  if (options.allowedExtensions) {
    const extension = path.extname(filePath).toLowerCase();
    const allowed = new Set(options.allowedExtensions.map((item) => item.toLowerCase()));
    if (!allowed.has(extension)) throw new Error(`Unsupported media extension: ${extension || "(none)"}`);
  }

  const stdout = await executeFile(
    options.execFileImpl ?? execFile,
    options.ffprobePath ?? "ffprobe",
    [...FFPROBE_ARGS, filePath],
  );
  let output;
  try {
    output = JSON.parse(stdout);
  } catch (cause) {
    throw new Error("FFprobe returned invalid JSON.", { cause });
  }

  const videoStream = output.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number(output.format?.duration);
  return {
    file_path: filePath,
    size_bytes: stats.size,
    duration_seconds: Number.isFinite(duration) ? duration : undefined,
    width: videoStream?.width,
    height: videoStream?.height,
    streams: Array.isArray(output.streams) ? output.streams.map((stream) => ({ ...stream })) : [],
  };
}

function executeFile(execFileImpl, command, args) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFprobe failed: ${String(stderr || error.message).trim()}`, { cause: error }));
        return;
      }
      resolve(stdout);
    });
  });
}
