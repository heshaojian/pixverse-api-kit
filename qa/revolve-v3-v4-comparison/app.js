const MAX_SYNC_DRIFT_SECONDS = 0.1;
const SEEK_STEPS = 1000;

const elements = Object.freeze({
  productList: document.querySelector("#product-list"),
  productPosition: document.querySelector("#product-position"),
  productBrand: document.querySelector("#product-brand"),
  productTitle: document.querySelector("#product-title"),
  productMeta: document.querySelector("#product-meta"),
  productLink: document.querySelector("#product-link"),
  previousProduct: document.querySelector("#previous-product"),
  nextProduct: document.querySelector("#next-product"),
  v3Video: document.querySelector("#v3-video"),
  v4Video: document.querySelector("#v4-video"),
  v3Model: document.querySelector("#v3-model"),
  v4Model: document.querySelector("#v4-model"),
  v3Spec: document.querySelector("#v3-spec"),
  v4Spec: document.querySelector("#v4-spec"),
  v3Error: document.querySelector("#v3-error.media-error"),
  v4Error: document.querySelector("#v4-error.media-error"),
  playToggle: document.querySelector("#play-toggle"),
  restart: document.querySelector("#restart"),
  timeline: document.querySelector("#timeline"),
  timeReadout: document.querySelector("#time-readout"),
  syncStatus: document.querySelector("#sync-status"),
  referenceCount: document.querySelector("#reference-count"),
  referenceStrip: document.querySelector("#reference-strip"),
  pageError: document.querySelector("#page-error"),
  videoToggles: [...document.querySelectorAll(".video-toggle")],
  audioModes: [...document.querySelectorAll('input[name="audio-mode"]')],
});

let manifest = Object.freeze({ products: [] });
let mediaEventController = null;
let state = Object.freeze({
  productIndex: 0,
  audioMode: "v4",
  ready: Object.freeze({ v3: false, v4: false }),
  playing: false,
  seeking: false,
  animationFrame: null,
  loadGeneration: 0,
});

const setState = (changes) => {
  state = Object.freeze({ ...state, ...changes });
};

const formatClock = (seconds) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const actualDuration = (video, fallback) => (
  Number.isFinite(video.duration) && video.duration > 0 ? video.duration : fallback
);

const currentProduct = () => manifest.products[state.productIndex];

const normalizedPosition = () => {
  const product = currentProduct();
  if (!product) return 0;
  const duration = actualDuration(elements.v3Video, product.v3.duration);
  return duration > 0 ? Math.min(1, elements.v3Video.currentTime / duration) : 0;
};

const updateHash = () => {
  const product = currentProduct();
  if (!product) return;
  const nextHash = new URLSearchParams({ sku: product.productId, audio: state.audioMode }).toString();
  if (window.location.hash.slice(1) !== nextHash) {
    history.replaceState(null, "", `#${nextHash}`);
  }
};

const applyAudioMode = () => {
  elements.v3Video.muted = state.audioMode !== "v3";
  elements.v4Video.muted = state.audioMode !== "v4";
  for (const input of elements.audioModes) input.checked = input.value === state.audioMode;
};

const renderSyncStatus = (message, status = "") => {
  elements.syncStatus.className = `sync-status${status ? ` is-${status}` : ""}`;
  elements.syncStatus.lastChild.textContent = ` ${message}`;
};

const updateTimeline = () => {
  if (state.seeking) return;
  const product = currentProduct();
  if (!product) return;
  const normalized = normalizedPosition();
  const v3Duration = actualDuration(elements.v3Video, product.v3.duration);
  elements.timeline.value = String(Math.round(normalized * SEEK_STEPS));
  elements.timeReadout.textContent = `${formatClock(normalized * v3Duration)} / ${formatClock(v3Duration)}`;
};

const alignVideos = (normalized = normalizedPosition()) => {
  const product = currentProduct();
  if (!product || !state.ready.v3 || !state.ready.v4) return;
  const v3Duration = actualDuration(elements.v3Video, product.v3.duration);
  const v4Duration = actualDuration(elements.v4Video, product.v4.duration);
  const v3Target = normalized * v3Duration;
  const v4Target = normalized * v4Duration;

  if (Math.abs(elements.v3Video.currentTime - v3Target) > MAX_SYNC_DRIFT_SECONDS) {
    elements.v3Video.currentTime = v3Target;
  }
  if (Math.abs(elements.v4Video.currentTime - v4Target) > MAX_SYNC_DRIFT_SECONDS) {
    elements.v4Video.currentTime = v4Target;
  }
};

const syncPlaybackRates = () => {
  const product = currentProduct();
  if (!product || !state.ready.v3 || !state.ready.v4) return;
  const v3Duration = actualDuration(elements.v3Video, product.v3.duration);
  const v4Duration = actualDuration(elements.v4Video, product.v4.duration);
  elements.v3Video.playbackRate = 1;
  elements.v4Video.playbackRate = v4Duration / v3Duration;
};

const stopSyncLoop = () => {
  if (state.animationFrame !== null) cancelAnimationFrame(state.animationFrame);
  setState({ animationFrame: null });
};

const syncLoop = () => {
  if (!state.playing) return;
  const product = currentProduct();
  if (!product) return;

  const normalized = normalizedPosition();
  const v4Duration = actualDuration(elements.v4Video, product.v4.duration);
  const v4Target = normalized * v4Duration;
  if (Math.abs(elements.v4Video.currentTime - v4Target) > MAX_SYNC_DRIFT_SECONDS) {
    elements.v4Video.currentTime = v4Target;
  }

  updateTimeline();
  setState({ animationFrame: requestAnimationFrame(syncLoop) });
};

const setPlaybackUi = (playing) => {
  elements.playToggle.innerHTML = `<span aria-hidden="true">${playing ? "&#10074;&#10074;" : "&#9654;"}</span>`;
  elements.playToggle.setAttribute("aria-label", playing ? "Pause both videos" : "Play both videos");
  elements.playToggle.title = playing ? "Pause both videos" : "Play both videos";
};

const pauseBoth = () => {
  elements.v3Video.pause();
  elements.v4Video.pause();
  stopSyncLoop();
  setState({ playing: false });
  setPlaybackUi(false);
};

const playBoth = async () => {
  if (!state.ready.v3 || !state.ready.v4) return;
  const loadGeneration = state.loadGeneration;
  if (normalizedPosition() >= 0.995) alignVideos(0);
  else alignVideos();
  syncPlaybackRates();

  const results = await Promise.allSettled([elements.v3Video.play(), elements.v4Video.play()]);
  if (state.loadGeneration !== loadGeneration) return;
  if (results.some(({ status }) => status === "rejected")) {
    pauseBoth();
    renderSyncStatus("Playback blocked", "error");
    return;
  }

  setState({ playing: true });
  setPlaybackUi(true);
  renderSyncStatus("Synchronized", "ready");
  stopSyncLoop();
  setState({ playing: true, animationFrame: requestAnimationFrame(syncLoop) });
};

const togglePlayback = () => {
  if (state.playing) pauseBoth();
  else void playBoth();
};

const seekTo = (normalized) => {
  const bounded = Math.min(1, Math.max(0, normalized));
  alignVideos(bounded);
  const product = currentProduct();
  const v3Duration = actualDuration(elements.v3Video, product.v3.duration);
  elements.timeline.value = String(Math.round(bounded * SEEK_STEPS));
  elements.timeReadout.textContent = `${formatClock(bounded * v3Duration)} / ${formatClock(v3Duration)}`;
};

const renderProductList = () => {
  const fragment = document.createDocumentFragment();
  manifest.products.forEach((product, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-option";
    button.dataset.index = String(index);
    button.setAttribute("aria-current", String(index === state.productIndex));

    const number = document.createElement("span");
    number.className = "product-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = product.name;
    const brand = document.createElement("span");
    brand.textContent = product.brand;
    copy.append(name, brand);
    button.append(number, copy);
    button.addEventListener("click", () => loadProduct(index));
    fragment.append(button);
  });
  elements.productList.replaceChildren(fragment);
};

const renderReferences = (product) => {
  const fragment = document.createDocumentFragment();
  product.references.forEach((source, index) => {
    const figure = document.createElement("figure");
    figure.className = "reference-item";
    const image = document.createElement("img");
    image.src = source;
    image.alt = `${product.brand} ${product.name} reference ${index + 1}`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      if (!figure.isConnected || currentProduct()?.productId !== product.productId) return;
      figure.remove();
      const count = elements.referenceStrip.childElementCount;
      elements.referenceCount.textContent = `${count} ${count === 1 ? "image" : "images"}`;
    }, { once: true });
    const marker = document.createElement("span");
    marker.textContent = String(index + 1).padStart(2, "0");
    figure.append(image, marker);
    fragment.append(figure);
  });
  elements.referenceStrip.replaceChildren(fragment);
  elements.referenceCount.textContent = `${product.references.length} images`;
};

const revealSelectedProduct = (selected) => {
  window.scrollTo({ top: 0, behavior: "auto" });
  if (window.matchMedia("(max-width: 900px)").matches) {
    const listRect = elements.productList.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    elements.productList.scrollBy({
      left: selectedRect.left - listRect.left - (listRect.width - selectedRect.width) / 2,
      behavior: "smooth",
    });
    return;
  }

  const rail = elements.productList.closest(".product-rail");
  const railRect = rail.getBoundingClientRect();
  const selectedRect = selected.getBoundingClientRect();
  rail.scrollBy({
    top: selectedRect.top - railRect.top - (railRect.height - selectedRect.height) / 2,
    behavior: "smooth",
  });
};

const setMediaReady = (version, loadGeneration) => {
  if (state.loadGeneration !== loadGeneration) return;
  const product = currentProduct();
  const video = version === "v3" ? elements.v3Video : elements.v4Video;
  if (!product || video.currentSrc !== new URL(product[version].video, window.location.href).href) return;
  const ready = Object.freeze({ ...state.ready, [version]: true });
  setState({ ready });
  if (ready.v3 && ready.v4) {
    elements.playToggle.disabled = false;
    elements.restart.disabled = false;
    elements.timeline.disabled = false;
    syncPlaybackRates();
    renderSyncStatus("Ready to compare", "ready");
    updateTimeline();
  }
};

const showMediaError = (version, loadGeneration) => {
  if (state.loadGeneration !== loadGeneration) return;
  const product = currentProduct();
  const failedVideo = version === "v3" ? elements.v3Video : elements.v4Video;
  if (!product || failedVideo.currentSrc !== new URL(product[version].video, window.location.href).href) return;
  const errorElement = version === "v3" ? elements.v3Error : elements.v4Error;
  const availableVideo = version === "v3" ? elements.v4Video : elements.v3Video;
  errorElement.hidden = false;
  pauseBoth();
  availableVideo.controls = true;
  elements.videoToggles.forEach((button) => { button.hidden = true; });
  renderSyncStatus(`${version.toUpperCase()} media error`, "error");
};

const loadProduct = (index, options = {}) => {
  const boundedIndex = ((index % manifest.products.length) + manifest.products.length) % manifest.products.length;
  const product = manifest.products[boundedIndex];
  const loadGeneration = state.loadGeneration + 1;
  pauseBoth();
  mediaEventController?.abort();
  mediaEventController = new AbortController();
  setState({
    productIndex: boundedIndex,
    ready: Object.freeze({ v3: false, v4: false }),
    seeking: false,
    loadGeneration,
  });

  elements.playToggle.disabled = true;
  elements.restart.disabled = true;
  elements.timeline.disabled = true;
  elements.timeline.value = "0";
  elements.v3Error.hidden = true;
  elements.v4Error.hidden = true;
  renderSyncStatus("Loading media");

  elements.productPosition.textContent = `${String(boundedIndex + 1).padStart(2, "0")} / ${String(manifest.products.length).padStart(2, "0")}`;
  elements.productBrand.textContent = product.brand;
  elements.productTitle.textContent = product.name;
  elements.productMeta.textContent = [product.productId, product.color, product.price].filter(Boolean).join(" · ");
  elements.productLink.href = product.productUrl;
  elements.v3Model.textContent = product.v3.model;
  elements.v4Model.textContent = product.v4.model;
  elements.v3Spec.textContent = `${product.v3.resolution} · ${product.v3.duration}s`;
  elements.v4Spec.textContent = `${product.v4.resolution} · ${product.v4.duration}s`;
  elements.timeReadout.textContent = `00:00 / ${formatClock(product.v3.duration)}`;

  elements.v3Video.poster = product.v3.poster;
  elements.v4Video.poster = product.v4.poster;
  elements.v3Video.controls = false;
  elements.v4Video.controls = false;
  elements.videoToggles.forEach((button) => { button.hidden = false; });
  const listenerOptions = { signal: mediaEventController.signal };
  elements.v3Video.addEventListener("loadedmetadata", () => setMediaReady("v3", loadGeneration), listenerOptions);
  elements.v4Video.addEventListener("loadedmetadata", () => setMediaReady("v4", loadGeneration), listenerOptions);
  elements.v3Video.addEventListener("error", () => showMediaError("v3", loadGeneration), listenerOptions);
  elements.v4Video.addEventListener("error", () => showMediaError("v4", loadGeneration), listenerOptions);
  elements.v3Video.src = product.v3.video;
  elements.v4Video.src = product.v4.video;
  applyAudioMode();
  elements.v3Video.load();
  elements.v4Video.load();

  renderProductList();
  renderReferences(product);
  const selected = elements.productList.querySelector(`[data-index="${boundedIndex}"]`);
  if (selected) revealSelectedProduct(selected);
  if (!options.skipHash) updateHash();
};

const parseHash = () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const sku = params.get("sku");
  const audio = params.get("audio");
  const productIndex = Math.max(0, manifest.products.findIndex(({ productId }) => productId === sku));
  const audioMode = ["v3", "v4", "muted"].includes(audio) ? audio : "v4";
  return Object.freeze({ productIndex, audioMode });
};

const restoreHashState = () => {
  if (!manifest.products.length) return;
  const restored = parseHash();
  const productChanged = restored.productIndex !== state.productIndex;
  const audioChanged = restored.audioMode !== state.audioMode;
  if (!productChanged && !audioChanged) return;
  setState({ audioMode: restored.audioMode });
  applyAudioMode();
  if (productChanged) loadProduct(restored.productIndex, { skipHash: true });
};

const bindEvents = () => {
  elements.playToggle.addEventListener("click", togglePlayback);
  elements.videoToggles.forEach((button) => button.addEventListener("click", togglePlayback));
  elements.restart.addEventListener("click", () => {
    pauseBoth();
    seekTo(0);
  });
  elements.previousProduct.addEventListener("click", () => loadProduct(state.productIndex - 1));
  elements.nextProduct.addEventListener("click", () => loadProduct(state.productIndex + 1));

  elements.timeline.addEventListener("pointerdown", () => setState({ seeking: true }));
  elements.timeline.addEventListener("input", (event) => seekTo(Number(event.currentTarget.value) / SEEK_STEPS));
  elements.timeline.addEventListener("change", () => setState({ seeking: false }));
  elements.timeline.addEventListener("pointerup", () => setState({ seeking: false }));
  elements.timeline.addEventListener("pointercancel", () => setState({ seeking: false }));

  elements.audioModes.forEach((input) => input.addEventListener("change", (event) => {
    setState({ audioMode: event.currentTarget.value });
    applyAudioMode();
    updateHash();
  }));

  elements.v3Video.addEventListener("ended", pauseBoth);
  elements.v4Video.addEventListener("ended", pauseBoth);
  window.addEventListener("hashchange", restoreHashState);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
    if (event.code === "Space") {
      event.preventDefault();
      togglePlayback();
    }
    if (event.code === "ArrowLeft") seekTo(normalizedPosition() - 0.05);
    if (event.code === "ArrowRight") seekTo(normalizedPosition() + 0.05);
  });
};

const initialize = async () => {
  try {
    const response = await fetch("./comparison-manifest.json");
    if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.products) || data.products.length === 0) throw new Error("Manifest has no products");
    manifest = Object.freeze({ ...data, products: Object.freeze([...data.products]) });
    const restored = parseHash();
    setState({ productIndex: restored.productIndex, audioMode: restored.audioMode });
    bindEvents();
    loadProduct(restored.productIndex);
  } catch (error) {
    console.error(error);
    elements.pageError.hidden = false;
  }
};

void initialize();
