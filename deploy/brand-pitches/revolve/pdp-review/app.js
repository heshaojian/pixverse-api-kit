import { validateComparisonCatalog } from "./data-model.js";
import { createPairController, createPlaybackCoordinator } from "./pair-controller.js";
import { renderComparisonRows } from "./render.js";
import { createReviewStore } from "./review-store.js";

const list = document.querySelector("#comparison-list");
const pageStatus = document.querySelector("#page-status");
const progress = document.querySelector("#review-progress");
const productJump = document.querySelector("#product-jump");
const controllers = new Map();

const unavailableStorage = Object.freeze({
  getItem() {
    throw new Error("Browser storage unavailable");
  },
  setItem() {
    throw new Error("Browser storage unavailable");
  },
});

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
};

const setPairStatus = (row, status) => {
  const target = row.querySelector(".pair-status");
  if (!target) return;
  const isError = status.type === "error";
  target.textContent = isError ? status.message : "";
  target.classList.toggle("is-error", isError);
};

const loadPoster = (video) => {
  const poster = video.dataset.poster;
  if (!poster) return;
  const image = new Image();
  image.addEventListener("load", () => {
    video.poster = poster;
    delete video.dataset.poster;
  }, { once: true });
  image.addEventListener("error", () => {
    delete video.dataset.poster;
  }, { once: true });
  image.src = poster;
};

const setupLazyPosters = () => {
  const videos = [...document.querySelectorAll("video[data-poster]")];
  const desktop = window.matchMedia("(min-width: 768px)").matches;
  const eagerCount = desktop ? 2 : 1;
  videos.slice(0, eagerCount).forEach(loadPoster);
  const deferred = videos.slice(eagerCount);
  if (!("IntersectionObserver" in window)) {
    deferred.forEach(loadPoster);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadPoster(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: desktop ? "500px 0px" : "240px 0px" });
  deferred.forEach((video) => observer.observe(video));
};

const populateJump = (catalog) => {
  productJump.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "Select a product";
  productJump.append(prompt);
  for (const product of catalog.products) {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${String(product.order).padStart(2, "0")} · ${product.brand} ${product.name}`;
    productJump.append(option);
  }
  productJump.disabled = false;
};

const restoreReviewChoices = (catalog, store) => {
  for (const product of catalog.products) {
    const choice = store.get(product.id);
    if (!choice) continue;
    const row = document.querySelector(`[data-product-id="${product.id}"]`);
    const radio = row?.querySelector(`input[name="review-${product.id}"][value="${choice}"]`);
    if (radio) radio.checked = true;
  }
};

const updateProgress = (store, total) => {
  progress.textContent = `${store.reviewedCount()} of ${total} reviewed`;
};

const setupPairControllers = () => {
  const coordinator = createPlaybackCoordinator();
  for (const row of document.querySelectorAll(".comparison-row")) {
    const id = row.dataset.productId;
    const original0911 = row.querySelector('[data-source-key="original0911"] video');
    const pdpStandardHigh = row.querySelector('[data-source-key="pdpStandardHigh"] video');
    const controller = createPairController({
      id,
      videos: { original0911, pdpStandardHigh },
      coordinator,
      onStatus(status) {
        setPairStatus(row, status);
      },
    });
    controllers.set(id, controller);
    for (const [sourceKey, video] of Object.entries({ original0911, pdpStandardHigh })) {
      video.addEventListener("error", () => {
        row.querySelector(`[data-source-key="${sourceKey}"]`)?.classList.add("media-unavailable");
        row.querySelector('[data-action="play-both"]')?.setAttribute("disabled", "");
        controller.markFailed(sourceKey);
      }, { once: true });
    }
  }
};

const setupInteractions = (catalog, store) => {
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    const row = button?.closest(".comparison-row");
    const controller = row ? controllers.get(row.dataset.productId) : null;
    if (!button || !controller) return;
    if (button.dataset.action === "play-both") await controller.playBoth();
    if (button.dataset.action === "pause-both") controller.pauseBoth();
    if (button.dataset.action === "restart-both") controller.restartBoth();
  });

  list.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "radio") return;
    const row = input.closest(".comparison-row");
    const productId = row?.dataset.productId;
    if (!productId) return;
    if (input.name.startsWith("audio-")) {
      controllers.get(productId)?.setAudioMode(input.value);
      return;
    }
    if (input.name.startsWith("review-")) {
      store.set(productId, input.value);
      updateProgress(store, catalog.products.length);
    }
  });

  productJump.addEventListener("change", () => {
    if (!productJump.value) return;
    document.querySelector(`#product-${productJump.value}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });
};

const bootstrap = async () => {
  const response = await fetch("./catalog.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  const catalog = validateComparisonCatalog(await response.json());
  list.innerHTML = renderComparisonRows(catalog);
  populateJump(catalog);
  const store = createReviewStore({
    storage: browserStorage(),
    productIds: catalog.products.map(({ id }) => id),
    key: "revolve-pdp-review.preferences.v2",
  });
  restoreReviewChoices(catalog, store);
  updateProgress(store, catalog.products.length);
  setupPairControllers();
  setupInteractions(catalog, store);
  setupLazyPosters();
  pageStatus.textContent = "";
};

window.addEventListener("pagehide", () => {
  for (const controller of controllers.values()) controller.pauseBoth();
});

bootstrap().catch(() => {
  list.replaceChildren();
  productJump.disabled = true;
  productJump.replaceChildren();
  pageStatus.textContent = "Comparison unavailable. Verify the local catalog and reload.";
});
