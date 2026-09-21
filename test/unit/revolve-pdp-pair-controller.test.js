import assert from "node:assert/strict";
import test from "node:test";

import {
  createPairController,
  createPlaybackCoordinator,
} from "../../deploy/brand-pitches/revolve/pdp-review/pair-controller.js";

const createVideoFake = ({ currentTime = 0, rejectPlay = false } = {}) => ({
  currentTime,
  muted: false,
  paused: true,
  playCalls: 0,
  pauseCalls: 0,
  async play() {
    this.playCalls += 1;
    if (rejectPlay) throw new Error("blocked");
    this.paused = false;
  },
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  },
});

const createControllerFixture = (id, coordinator, options = {}) => {
  const original0911 = createVideoFake(options.original0911);
  const pdpStandardHigh = createVideoFake(options.pdpStandardHigh);
  const statuses = [];
  const controller = createPairController({
    id,
    videos: { original0911, pdpStandardHigh },
    coordinator,
    onStatus(status) {
      statuses.push(status);
    },
  });
  return { controller, original0911, pdpStandardHigh, statuses };
};

test("play aligns to the earlier timestamp and starts both muted", async () => {
  const fixture = createControllerFixture("SKU", createPlaybackCoordinator(), {
    original0911: { currentTime: 5.2 },
    pdpStandardHigh: { currentTime: 3.1 },
  });

  assert.equal(await fixture.controller.playBoth(), true);
  assert.equal(fixture.original0911.currentTime, 3.1);
  assert.equal(fixture.pdpStandardHigh.currentTime, 3.1);
  assert.equal(fixture.original0911.muted, true);
  assert.equal(fixture.pdpStandardHigh.muted, true);
  assert.equal(fixture.original0911.playCalls, 1);
  assert.equal(fixture.pdpStandardHigh.playCalls, 1);
  assert.deepEqual(fixture.statuses.at(-1), { type: "playing" });
});

test("audio selection keeps at most one source audible", () => {
  const fixture = createControllerFixture("SKU", createPlaybackCoordinator());

  fixture.controller.setAudioMode("original0911");
  assert.equal(fixture.original0911.muted, false);
  assert.equal(fixture.pdpStandardHigh.muted, true);

  fixture.controller.setAudioMode("pdpStandardHigh");
  assert.equal(fixture.original0911.muted, true);
  assert.equal(fixture.pdpStandardHigh.muted, false);

  fixture.controller.setAudioMode("muted");
  assert.equal(fixture.original0911.muted, true);
  assert.equal(fixture.pdpStandardHigh.muted, true);
  assert.throws(() => fixture.controller.setAudioMode("both"), /audio mode/);
});

test("starting another pair pauses the active pair", async () => {
  const coordinator = createPlaybackCoordinator();
  const first = createControllerFixture("one", coordinator);
  const second = createControllerFixture("two", coordinator);

  await first.controller.playBoth();
  await second.controller.playBoth();

  assert.equal(first.original0911.pauseCalls, 1);
  assert.equal(first.pdpStandardHigh.pauseCalls, 1);
  assert.equal(second.original0911.playCalls, 1);
  assert.equal(second.pdpStandardHigh.playCalls, 1);
});

test("pause and restart operate on both videos", async () => {
  const fixture = createControllerFixture("SKU", createPlaybackCoordinator(), {
    original0911: { currentTime: 4 },
    pdpStandardHigh: { currentTime: 7 },
  });

  await fixture.controller.playBoth();
  fixture.controller.pauseBoth();
  assert.equal(fixture.original0911.paused, true);
  assert.equal(fixture.pdpStandardHigh.paused, true);

  fixture.original0911.currentTime = 2;
  fixture.pdpStandardHigh.currentTime = 3;
  fixture.controller.restartBoth();
  assert.equal(fixture.original0911.currentTime, 0);
  assert.equal(fixture.pdpStandardHigh.currentTime, 0);
  assert.deepEqual(fixture.statuses.at(-1), { type: "paused" });
});

test("source failure disables shared playback but leaves a concise status", async () => {
  const fixture = createControllerFixture("SKU", createPlaybackCoordinator());
  fixture.controller.markFailed("original0911");

  assert.equal(await fixture.controller.playBoth(), false);
  assert.equal(fixture.original0911.playCalls, 0);
  assert.equal(fixture.pdpStandardHigh.playCalls, 0);
  assert.deepEqual(fixture.statuses.at(-1), {
    type: "error",
    message: "Shared playback unavailable. Use the individual video controls.",
  });
  assert.throws(() => fixture.controller.markFailed("unknown"), /source key/);
});

test("rejected playback pauses both sources and releases the coordinator", async () => {
  const coordinator = createPlaybackCoordinator();
  const failed = createControllerFixture("failed", coordinator, {
    pdpStandardHigh: { rejectPlay: true },
  });
  const next = createControllerFixture("next", coordinator);

  assert.equal(await failed.controller.playBoth(), false);
  assert.equal(failed.original0911.paused, true);
  assert.equal(failed.pdpStandardHigh.paused, true);
  const pauseCount = failed.original0911.pauseCalls;

  await next.controller.playBoth();
  assert.equal(failed.original0911.pauseCalls, pauseCount);
});

test("destroy pauses and prevents later playback", async () => {
  const fixture = createControllerFixture("SKU", createPlaybackCoordinator());
  await fixture.controller.playBoth();
  fixture.controller.destroy();

  assert.equal(fixture.original0911.paused, true);
  assert.equal(fixture.pdpStandardHigh.paused, true);
  assert.equal(await fixture.controller.playBoth(), false);
});

test("controller validates construction inputs", () => {
  const coordinator = createPlaybackCoordinator();
  assert.throws(
    () => createPairController({ id: "", videos: {}, coordinator, onStatus() {} }),
    /id/,
  );
  assert.throws(
    () => createPairController({ id: "SKU", videos: {}, coordinator, onStatus() {} }),
    /original0911/,
  );
});
