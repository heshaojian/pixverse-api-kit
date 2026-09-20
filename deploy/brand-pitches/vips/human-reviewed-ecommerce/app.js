import { validatePitchData } from "./data-model.js";
import { renderLedger } from "./render.js";

const DATA_URL = "./data/cases.json";
const FAILURE_MESSAGE = "完整评审暂不可用，请稍后重试。";
const FEATURED_POSTER_PATHS = new Set([
  "./assets/images/featured-presenter-poster.jpg",
  "./assets/images/featured-creative-poster.jpg",
]);

export async function loadPitchData(fetchImpl = fetch) {
  const response = await fetchImpl(DATA_URL, { credentials: "omit" });
  if (!response.ok) throw new Error(`Pitch data request failed: ${response.status}`);
  return validatePitchData(await response.json());
}

const showMediaUnavailable = (element) => {
  const fallback = element.closest(".media-frame")?.querySelector(".media-unavailable");
  if (fallback) {
    fallback.hidden = false;
    fallback.textContent = element.tagName === "VIDEO" ? "视频暂不可用" : "素材暂不可用";
  }
};

const attachOneDeferredMedia = (element) => {
  element.addEventListener("error", () => showMediaUnavailable(element), { once: true });
  if (element.dataset.poster) {
    element.setAttribute("poster", element.dataset.poster);
  }
  if (element.dataset.src) {
    element.setAttribute("src", element.dataset.src);
  }
  if (element.tagName === "VIDEO") {
    element.load();
  }
};

export function attachDeferredMedia(root, observerFactory = null) {
  const elements = Object.freeze([...root.querySelectorAll("[data-src]")]);
  if (!elements.length) return null;
  if (!("IntersectionObserver" in globalThis) && observerFactory === null) {
    for (const element of elements) attachOneDeferredMedia(element);
    return null;
  }
  const createObserver = observerFactory ?? ((callback) => new IntersectionObserver(callback, {
    rootMargin: "320px 0px",
    threshold: 0.01,
  }));
  const observer = createObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      attachOneDeferredMedia(entry.target);
      observer.unobserve(entry.target);
    }
  });
  for (const element of elements) observer.observe(element);
  return observer;
}

export function attachDesktopPosters(root, mediaQuery = null) {
  const desktopQuery = mediaQuery ?? window.matchMedia("(min-width: 900px)");
  const applyPosters = () => {
    if (!desktopQuery.matches) return 0;
    let attached = 0;
    for (const element of root.querySelectorAll("video[data-desktop-poster]")) {
      const poster = element.dataset.desktopPoster;
      if (!FEATURED_POSTER_PATHS.has(poster)) continue;
      element.setAttribute("poster", poster);
      attached += 1;
    }
    desktopQuery.removeEventListener?.("change", applyPosters);
    return attached;
  };

  const attached = applyPosters();
  if (!attached) desktopQuery.addEventListener?.("change", applyPosters, { once: true });
  return attached;
}

const openDeepLink = (root, hash = window.location.hash) => {
  if (!hash || hash.length < 2) return;
  const id = decodeURIComponent(hash.slice(1));
  const target = root.querySelector(`#${CSS.escape(id)}`);
  if (!target) return;
  for (const detail of target.closest("details") ? [target.closest("details")] : []) {
    detail.open = true;
  }
  for (const detail of target.querySelectorAll("details")) {
    detail.open = true;
  }
  target.querySelector("summary")?.focus({ preventScroll: true });
};

export function renderLedgerInto({ mount, fallback, data }) {
  const validated = validatePitchData(data);
  const markup = renderLedger(validated);
  const template = document.createElement("template");
  const fragment = document.createRange().createContextualFragment(markup);
  template.content.replaceChildren(fragment);
  mount.replaceChildren(template.content.cloneNode(true));
  if (fallback) fallback.hidden = true;
  attachDeferredMedia(mount);
  openDeepLink(mount);
}

const showLedgerFailure = (fallback) => {
  if (!fallback) return;
  fallback.hidden = false;
  fallback.textContent = FAILURE_MESSAGE;
};

export async function initPitchPage({
  documentRef = document,
  fetchImpl = fetch,
} = {}) {
  attachDesktopPosters(documentRef);
  const mount = documentRef.querySelector("#ledger-mount");
  const fallback = documentRef.querySelector(".ledger-fallback");
  if (!mount) return;
  try {
    const data = await loadPitchData(fetchImpl);
    renderLedgerInto({ mount, fallback, data });
  } catch {
    showLedgerFailure(fallback);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initPitchPage(), { once: true });
  } else {
    initPitchPage();
  }
}
