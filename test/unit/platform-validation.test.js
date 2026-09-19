import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { getPlatformOperation, PLATFORM_OPERATIONS } from "../../src/platform/operations.js";
import { normalizeAndValidatePlatformInput } from "../../src/platform/validation.js";

const invalidById = Object.freeze({
  "account.balance": null,
  "account.usage": { start_time: "2026-09-20 00:00:00", end_time: "2026-09-18 00:00:00" },
  "upload.image": {},
  "upload.media": { file: "a", file_url: "https://example.com/a.mp4" },
  "resource.templates": null,
  "resource.tts-speakers": null,
  "resource.restyle-effects": {},
  "voice.create": {},
  "voice.delete": { speaker_id: Number.MAX_SAFE_INTEGER + 1 },
  "image.template": {},
  "image.status": { image_id: Number.MAX_SAFE_INTEGER + 1 },
  "video.text": {},
  "video.image": {},
  "video.template": {},
  "video.transition": {},
  "video.multi-transition": { multi_transition: [{ img_id: "1" }] },
  "video.lip-sync": {},
  "video.fusion": { image_references: [] },
  "video.restyle": {},
  "video.swap-mask": {},
  "video.swap": {},
  "video.sound-effect": {},
  "video.extend": {},
  "video.motion-control": {},
  "video.modify": {},
  "video.upscale": {},
  "video.avatar": {},
  "agent.viral-recreation": {},
  "agent.real-estate": {},
  "video.status": { video_id: Number.MAX_SAFE_INTEGER + 1 },
});

test("the RED table independently covers every Platform operation ID", () => {
  assert.deepEqual(Object.keys(invalidById).sort(), PLATFORM_OPERATIONS.map(({ id }) => id).sort());
});

for (const operation of PLATFORM_OPERATIONS) {
  test(`${operation.id} rejects its minimal invalid input before fetch`, async () => {
    const context = {
      fetchCalls: [],
      inspectLocalMedia: async () => {
        throw new Error("media inspection must not run for a structurally invalid request");
      },
    };
    await assert.rejects(
      normalizeAndValidatePlatformInput(operation, invalidById[operation.id], context),
      /input|required|provide|safe integer|string|start|source|reference|item|page/i,
    );
    assert.equal(context.fetchCalls.length, 0);
  });
}

test("normalization preserves unknown official fields and never mutates deeply frozen input", async () => {
  const input = Object.freeze({
    prompt: "A paper boat crosses a puddle.",
    model: "v6",
    quality: "720p",
    duration: 5,
    aspect_ratio: "16:9",
    seed: 42,
    newly_released_option: Object.freeze({ enabled: true }),
  });

  const result = await normalizeAndValidatePlatformInput(getPlatformOperation("video.text"), input);

  assert.deepEqual(result.payload, input);
  assert.notEqual(result.payload, input);
  assert.notEqual(result.payload.newly_released_option, input.newly_released_option);
  assert.deepEqual(result.query, {});
  assert.deepEqual(result.pathParams, {});
  assert.deepEqual(result.files, {});
  assert.equal(result.validationSummary.operation, "video.text");
});

test("unsafe numeric identifiers are rejected instead of being rounded", async () => {
  await assert.rejects(
    normalizeAndValidatePlatformInput(getPlatformOperation("video.status"), {
      video_id: 627410861853514292,
    }),
    /video_id.*string/i,
  );
  const result = await normalizeAndValidatePlatformInput(getPlatformOperation("video.status"), {
    video_id: 42,
  });
  assert.equal(result.pathParams.video_id, "42");
});

test("upload inputs require exactly one endpoint-specific local file or safe remote URL", async () => {
  const image = getPlatformOperation("upload.image");
  const media = getPlatformOperation("upload.media");
  await assert.rejects(normalizeAndValidatePlatformInput(image, {}), /exactly one.*image.*image_url/i);
  await assert.rejects(normalizeAndValidatePlatformInput(image, {
    image: "/tmp/a.png",
    image_url: "https://cdn.example.com/a.png",
  }), /exactly one.*image.*image_url/i);
  await assert.rejects(normalizeAndValidatePlatformInput(media, {
    file_url: "file:///etc/passwd",
  }), /http|url/i);
  await assert.rejects(normalizeAndValidatePlatformInput(image, {
    image_url: "https://user:password@example.com/a.png",
  }), /credentials|url/i);
  for (const image_url of [
    "http://[::ffff:127.0.0.1]/a.png",
    "http://[::ffff:10.0.0.1]/a.png",
    "http://[fe80::1]/a.png",
    "http://[fd00::1]/a.png",
  ]) {
    await assert.rejects(normalizeAndValidatePlatformInput(image, { image_url }), /local|private/i);
  }
});

test("image uploads enforce published extension, size, and dimension limits through injected inspection", async () => {
  const operation = getPlatformOperation("upload.image");
  const calls = [];
  const valid = await normalizeAndValidatePlatformInput(operation, { image: "/safe/tiny.png", tag: "kept" }, {
    inspectLocalMedia: async (file, options) => {
      calls.push({ file, options });
      return { size_bytes: 100, width: 1, height: 1, streams: [] };
    },
  });
  assert.deepEqual(valid.files, { image: "/safe/tiny.png" });
  assert.deepEqual(valid.payload, { tag: "kept" });
  assert.deepEqual(calls, [{
    file: "/safe/tiny.png",
    options: {
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
      maxBytes: 20 * 1024 * 1024 - 1,
    },
  }]);

  for (const metadata of [
    { size_bytes: 20 * 1024 * 1024 + 1, width: 1, height: 1 },
    { size_bytes: 100, width: 10_001, height: 1 },
    { size_bytes: 100, width: 1, height: 10_001 },
  ]) {
    await assert.rejects(normalizeAndValidatePlatformInput(operation, { image: "/safe/tiny.png" }, {
      inspectLocalMedia: async () => metadata,
    }), /20 MB|10,?000|size|dimension/i);
  }
});

test("usage timestamps reject impossible UTC calendar dates", async () => {
  await assert.rejects(normalizeAndValidatePlatformInput(getPlatformOperation("account.usage"), {
    start_time: "2026-02-30 00:00:00",
    end_time: "2026-03-01 00:00:00",
  }), /start_time/i);
});

test("transition, fusion, voice, swap, source-video, and agent inputs enforce their identifier combinations", async () => {
  const cases = [
    ["video.transition", {
      first_frame_img: "1", prompt: "move", model: "v6", duration: 5, quality: "720p",
    }, /last.*frame/i],
    ["video.multi-transition", {
      model: "v5", quality: "720p", multi_transition: [{ img_id: "1" }],
    }, /item|transition/i],
    ["video.fusion", {
      prompt: "combine", image_references: [], model: "v6", duration: 5,
      quality: "720p", aspect_ratio: "16:9",
    }, /reference|image/i],
    ["video.lip-sync", { source_video_id: "1" }, /audio|speaker|tts/i],
    ["video.swap-mask", { keyframe_id: 1 }, /source/i],
    ["video.restyle", { restyle_id: "1" }, /source/i],
    ["agent.viral-recreation", { agent_id: "414562414124109", prompt: "remake" }, /reference/i],
    ["agent.real-estate", { agent_id: "419629433597950" }, /model/i],
  ];
  for (const [id, input, pattern] of cases) {
    await assert.rejects(normalizeAndValidatePlatformInput(getPlatformOperation(id), input), pattern);
  }
});

test("model-aware scalar validation rejects invalid prompt, quality, duration, aspect ratio, and seed", async () => {
  const operation = getPlatformOperation("video.text");
  const base = { prompt: "hello", model: "v6", quality: "720p", duration: 5, aspect_ratio: "16:9" };
  const cases = [
    [{ ...base, prompt: "" }, /prompt/i],
    [{ ...base, prompt: "x".repeat(5001) }, /prompt/i],
    [{ ...base, quality: "cinema" }, /quality/i],
    [{ ...base, duration: 16 }, /duration/i],
    [{ ...base, aspect_ratio: "square-ish" }, /aspect/i],
    [{ ...base, seed: -1 }, /seed/i],
    [{ ...base, seed: 2_147_483_648 }, /seed/i],
  ];
  for (const [input, pattern] of cases) {
    await assert.rejects(normalizeAndValidatePlatformInput(operation, input), pattern);
  }
});

test("fusion enforces exact model duration, quality, aspect, and omni-video rules", async () => {
  const operation = getPlatformOperation("video.fusion");
  const base = {
    image_references: [{ img_id: "1", ref_name: "subject" }],
    prompt: "Animate @subject",
    quality: "720p",
  };
  for (const input of [
    { ...base, model: "v4.5", duration: 5, aspect_ratio: "16:9" },
    { ...base, model: "v5.6", duration: 10, aspect_ratio: "9:16" },
    { ...base, model: "v6", duration: 1, aspect_ratio: "21:9" },
    {
      ...base, model: "v6", duration: 0, aspect_ratio: "2:3", reference_mode: "omni",
      video_references: [{ video_id: "2", ref_name: "motion" }],
    },
  ]) {
    await normalizeAndValidatePlatformInput(operation, input);
  }
  for (const input of [
    { ...base, model: "v4.5", duration: 10, aspect_ratio: "16:9" },
    { ...base, model: "v5.6", duration: 10, quality: "1080p", aspect_ratio: "16:9" },
    { ...base, model: "v5.6", duration: 5, aspect_ratio: "21:9" },
    { ...base, model: "v6", duration: 16, aspect_ratio: "16:9" },
    { ...base, model: "v6", duration: 5, aspect_ratio: "16:9", reference_mode: "unknown" },
  ]) {
    await assert.rejects(normalizeAndValidatePlatformInput(operation, input), /duration|aspect_ratio|reference_mode/i);
  }
});

test("official multi-transition order and bounds are validated", async () => {
  const operation = getPlatformOperation("video.multi-transition");
  const base = { model: "v5", quality: "720p" };
  await assert.rejects(normalizeAndValidatePlatformInput(operation, {
    ...base,
    multi_transition: [{ img_id: "1", duration: 3 }],
  }), /2.*7/i);
  await assert.rejects(normalizeAndValidatePlatformInput(operation, {
    ...base,
    multi_transition: [{ img_id: "1" }, { img_id: "2" }],
  }), /duration.*last/i);
  const result = await normalizeAndValidatePlatformInput(operation, {
    ...base,
    multi_transition: [{ img_id: "1", duration: 3 }, { img_id: "2" }],
  });
  assert.equal(result.payload.multi_transition[0].img_id, "1");

  const sentinel = await normalizeAndValidatePlatformInput(operation, {
    ...base,
    multi_transition: [{ img_id: "1", duration: 3 }, { img_id: "2", duration: 0 }],
  });
  assert.equal(sentinel.payload.multi_transition[1].duration, 0);
  await assert.rejects(normalizeAndValidatePlatformInput(operation, {
    ...base,
    multi_transition: [{ img_id: "1", duration: 0 }, { img_id: "2" }],
  }), /duration.*positive/i);
});

test("official mutually-exclusive source and lip-sync combinations are validated", async () => {
  await assert.rejects(normalizeAndValidatePlatformInput(getPlatformOperation("video.extend"), {
    source_video_id: "1", video_media_id: "2", prompt: "continue", seed: 1,
    quality: "720p", duration: 5, model: "v6",
  }), /exactly one.*source_video_id.*video_media_id/i);
  await assert.rejects(normalizeAndValidatePlatformInput(getPlatformOperation("video.lip-sync"), {
    source_video_id: "1", audio_media_id: "2",
    lip_sync_tts_speaker_id: "3", lip_sync_tts_content: "hello",
  }), /either.*audio_media_id.*tts/i);
});

test("swap and swap-mask accept positive keyframe identifiers after string-safe normalization", async () => {
  const swap = await normalizeAndValidatePlatformInput(getPlatformOperation("video.swap"), {
    source_video_id: "1",
    keyframe_id: 7,
    mask_id: "2",
    img_id: "3",
    quality: "720p",
  });
  assert.equal(swap.payload.keyframe_id, "7");

  const mask = await normalizeAndValidatePlatformInput(getPlatformOperation("video.swap-mask"), {
    video_media_id: "4",
    keyframe_id: "12",
  });
  assert.equal(mask.payload.keyframe_id, "12");

  const firstFrameMask = await normalizeAndValidatePlatformInput(getPlatformOperation("video.swap-mask"), {
    source_video_id: "5",
    keyframe_id: 0,
  });
  assert.equal(firstFrameMask.payload.keyframe_id, "0");
});

test("keyframe identifiers apply endpoint-specific zero rules and reject invalid values", async () => {
  const maskOperation = getPlatformOperation("video.swap-mask");
  for (const keyframe_id of [-1, "-1", "1.5", "frame-one", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(normalizeAndValidatePlatformInput(maskOperation, {
      source_video_id: "1",
      keyframe_id,
    }), /keyframe_id|string|safe integer/i);
  }
  for (const keyframe_id of [0, "0"]) {
    await assert.rejects(normalizeAndValidatePlatformInput(getPlatformOperation("video.swap"), {
      source_video_id: "1",
      keyframe_id,
      mask_id: "2",
      img_id: "3",
      quality: "720p",
    }), /keyframe_id/i);
  }
});

test("read-only query fields are separated and validated without losing unknown payload fields", async () => {
  const result = await normalizeAndValidatePlatformInput(getPlatformOperation("resource.tts-speakers"), {
    page_num: 1,
    page_size: 20,
    speaker_type: "custom",
    future_filter: "kept",
  });
  assert.deepEqual(result.query, { page_num: 1, page_size: 20, speaker_type: "custom" });
  assert.deepEqual(result.payload, { future_filter: "kept" });
  await assert.rejects(normalizeAndValidatePlatformInput(getPlatformOperation("resource.tts-speakers"), {
    page_size: 25,
  }), /page_size/i);
});

test("checked-in tiny media fixtures are non-empty and viral-agent local references use injected media policy", async () => {
  for (const name of ["tiny.png", "tiny.mp4", "tiny.wav"]) {
    const stats = await fs.stat(new URL(`../fixtures/media/${name}`, import.meta.url));
    assert.ok(stats.size > 0, `${name} must be a non-empty fixture`);
  }

  const operation = getPlatformOperation("agent.viral-recreation");
  const input = {
    agent_id: "414562414124109",
    prompt: "Recreate this rhythm without copying branding.",
    quality: "720p",
    img_references: [{ file: "/safe/tiny.png" }],
    video_references: [{ file: "/safe/tiny.mp4" }],
  };
  const calls = [];
  await normalizeAndValidatePlatformInput(operation, input, {
    inspectLocalMedia: async (file, options) => {
      calls.push({ file, options });
      return file.endsWith(".png")
        ? { size_bytes: 100, width: 1000, height: 1000 }
        : { size_bytes: 100, width: 1080, height: 1080, duration_seconds: 15 };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.maxBytes, 20 * 1024 * 1024);
  assert.equal(calls[1].options.maxBytes, 100 * 1024 * 1024);

  await assert.rejects(normalizeAndValidatePlatformInput(operation, input, {
    inspectLocalMedia: async (file) => file.endsWith(".png")
      ? { size_bytes: 100, width: 1000, height: 1000 }
      : { size_bytes: 100, width: 1080, height: 1080, duration_seconds: 31 },
  }), /duration.*2.*30/i);
});
