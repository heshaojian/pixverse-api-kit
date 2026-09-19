import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectLocalMedia } from "../../src/core/media.js";

test("inspectLocalMedia invokes FFprobe via argument array without a shell", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-core-media-"));
  const mediaPath = path.join(directory, "clip;not-a-command.mp4");
  await fs.writeFile(mediaPath, "fake-media");
  const execCalls = [];

  try {
    const result = await inspectLocalMedia(mediaPath, {
      execFileImpl(command, args, options, callback) {
        execCalls.push({ command, args, options });
        callback(null, JSON.stringify({
          format: { duration: "3.5", size: "10" },
          streams: [{ codec_type: "video", width: 1280, height: 720 }],
        }), "");
      },
    });

    assert.equal(execCalls[0].command, "ffprobe");
    assert.deepEqual(execCalls[0].args, [
      "-v", "error",
      "-show_entries", "format=duration,size:stream=codec_type,width,height",
      "-of", "json",
      mediaPath,
    ]);
    assert.equal(execCalls[0].options.shell, false);
    assert.equal(result.duration_seconds, 3.5);
    assert.equal(result.width, 1280);
    assert.equal(result.height, 720);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("inspectLocalMedia rejects symlinks and oversized files before FFprobe", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-core-media-"));
  const realPath = path.join(directory, "real.mp4");
  const linkPath = path.join(directory, "link.mp4");
  await fs.writeFile(realPath, "12345");
  await fs.symlink(realPath, linkPath);

  try {
    await assert.rejects(inspectLocalMedia(linkPath), /symbolic link/i);
    await assert.rejects(inspectLocalMedia(realPath, { maxBytes: 4 }), /maximum size/i);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("inspectLocalMedia validates extensions and FFprobe results", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-core-media-"));
  const mediaPath = path.join(directory, "clip.mp4");
  await fs.writeFile(mediaPath, "fake-media");

  try {
    await assert.rejects(
      inspectLocalMedia(mediaPath, { allowedExtensions: [".mov"] }),
      /unsupported media extension/i,
    );
    await assert.rejects(
      inspectLocalMedia(mediaPath, {
        execFileImpl(command, args, options, callback) { callback(null, "not-json", ""); },
      }),
      /invalid JSON/i,
    );
    await assert.rejects(
      inspectLocalMedia(mediaPath, {
        execFileImpl(command, args, options, callback) { callback(new Error("missing"), "", "not installed"); },
      }),
      /FFprobe failed: not installed/i,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
