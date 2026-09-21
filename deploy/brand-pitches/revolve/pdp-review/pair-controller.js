const SOURCE_KEYS = Object.freeze(["original0911", "pdpStandardHigh"]);
const AUDIO_MODES = Object.freeze(["muted", ...SOURCE_KEYS]);
const PLAYBACK_ERROR = Object.freeze({
  type: "error",
  message: "Shared playback unavailable. Use the individual video controls.",
});

const isVideoLike = (video) => (
  video
  && typeof video.play === "function"
  && typeof video.pause === "function"
  && "currentTime" in video
  && "muted" in video
);

export function createPlaybackCoordinator() {
  let active = null;
  return Object.freeze({
    activate(id, pause) {
      if (active && active.id !== id) active.pause();
      active = Object.freeze({ id, pause });
    },
    release(id) {
      if (active?.id === id) active = null;
    },
  });
}

export function createPairController({ id, videos, coordinator, onStatus }) {
  if (typeof id !== "string" || !id.trim()) throw new Error("Pair id is required");
  if (!videos || !isVideoLike(videos.original0911)) {
    throw new Error("Pair original0911 video is required");
  }
  if (!isVideoLike(videos.pdpStandardHigh)) {
    throw new Error("Pair pdpStandardHigh video is required");
  }
  if (!coordinator || typeof coordinator.activate !== "function" || typeof coordinator.release !== "function") {
    throw new Error("Pair coordinator is required");
  }
  if (typeof onStatus !== "function") throw new Error("Pair onStatus callback is required");

  let audioMode = "muted";
  let failedSources = new Set();
  let destroyed = false;
  const pair = SOURCE_KEYS.map((sourceKey) => videos[sourceKey]);

  const applyAudioMode = () => {
    videos.original0911.muted = audioMode !== "original0911";
    videos.pdpStandardHigh.muted = audioMode !== "pdpStandardHigh";
  };

  const pauseBoth = () => {
    for (const video of pair) video.pause();
    coordinator.release(id);
    onStatus({ type: "paused" });
  };

  applyAudioMode();

  const controller = {
    async playBoth() {
      if (destroyed) return false;
      if (failedSources.size > 0) {
        onStatus(PLAYBACK_ERROR);
        return false;
      }
      coordinator.activate(id, pauseBoth);
      const targetTime = Math.min(...pair.map(({ currentTime }) => Number(currentTime) || 0));
      for (const video of pair) video.currentTime = targetTime;
      applyAudioMode();
      try {
        await Promise.all(pair.map((video) => video.play()));
        onStatus({ type: "playing" });
        return true;
      } catch {
        pauseBoth();
        onStatus(PLAYBACK_ERROR);
        return false;
      }
    },
    pauseBoth,
    restartBoth() {
      if (destroyed) return;
      pauseBoth();
      for (const video of pair) video.currentTime = 0;
    },
    setAudioMode(mode) {
      if (!AUDIO_MODES.includes(mode)) throw new Error(`Unknown audio mode: ${mode}`);
      audioMode = mode;
      applyAudioMode();
    },
    markFailed(sourceKey) {
      if (!SOURCE_KEYS.includes(sourceKey)) throw new Error(`Unknown source key: ${sourceKey}`);
      failedSources = new Set([...failedSources, sourceKey]);
      pauseBoth();
      onStatus(PLAYBACK_ERROR);
    },
    destroy() {
      if (destroyed) return;
      pauseBoth();
      destroyed = true;
    },
  };

  return Object.freeze(controller);
}
