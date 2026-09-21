import { SOURCE_KEYS, validateComparisonCatalog } from "./data-model.js";

const REVIEW_OPTIONS = Object.freeze([
  ["prefer-a", "Prefer A"],
  ["prefer-b", "Prefer B"],
  ["tie", "Tie"],
  ["needs-review", "Needs review"],
]);

const AUDIO_OPTIONS = Object.freeze([
  ["muted", "Muted"],
  ["original0911", "A"],
  ["pdpStandardHigh", "B"],
]);

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const renderSource = (product, sourceKey) => {
  const source = product.sources[sourceKey];
  const sourceName = sourceKey === "original0911" ? "0911 Original" : "PDP Standard/high";
  const label = escapeHtml(source.label);
  const videoUrl = escapeHtml(source.videoUrl);
  const poster = escapeHtml(source.poster);
  const productName = escapeHtml(`${product.brand} ${product.name}`);
  return `
    <section class="source-panel" data-source-key="${sourceKey}" aria-label="${label}">
      <div class="source-heading">
        <h3 class="source-label">${label}</h3>
        <span>${sourceKey === "original0911" ? "Baseline" : "Candidate"}</span>
      </div>
      <div class="media-frame">
        <video src="${videoUrl}" data-poster="${poster}" controls playsinline preload="none" aria-label="${escapeHtml(sourceName)} video for ${productName}" aria-describedby="motion-${escapeHtml(product.id)}"></video>
        <p class="media-fallback" role="status">Video preview unavailable. Use the direct link below.</p>
      </div>
      <a class="direct-link" href="${videoUrl}" target="_blank" rel="noreferrer">Open ${escapeHtml(sourceName)} video</a>
    </section>`;
};

const renderAudioOptions = (productId) => AUDIO_OPTIONS.map(([value, label], index) => `
  <label class="segmented-option">
    <input type="radio" name="audio-${escapeHtml(productId)}" value="${value}"${index === 0 ? " checked" : ""}>
    <span>${label}</span>
  </label>`).join("");

const renderReviewOptions = (productId) => REVIEW_OPTIONS.map(([value, label]) => `
  <label class="review-option">
    <input type="radio" name="review-${escapeHtml(productId)}" value="${value}">
    <span>${label}</span>
  </label>`).join("");

const renderProduct = (product) => {
  const id = escapeHtml(product.id);
  const order = String(product.order).padStart(2, "0");
  return `
<article class="comparison-row" id="product-${id}" data-product-id="${id}">
  <header class="product-heading">
    <div class="product-index" aria-hidden="true">${order}</div>
    <div class="product-title">
      <p>${escapeHtml(product.brand)}</p>
      <h2>${escapeHtml(product.name)}</h2>
      <span>${escapeHtml(product.variant)} · ${id}</span>
    </div>
    <a class="product-link" href="${escapeHtml(product.productUrl)}" target="_blank" rel="noreferrer">View product</a>
  </header>
  <p class="sr-only" id="motion-${id}">${escapeHtml(product.motionDescription)}</p>
  <div class="comparison-grid">
    ${SOURCE_KEYS.map((sourceKey) => renderSource(product, sourceKey)).join("")}
  </div>
  <div class="pair-controls" aria-label="Shared playback controls for ${escapeHtml(product.brand)} ${escapeHtml(product.name)}">
    <div class="button-group">
      <button type="button" data-action="play-both">Play both</button>
      <button type="button" data-action="pause-both">Pause both</button>
      <button type="button" data-action="restart-both">Restart both</button>
    </div>
    <fieldset class="audio-group">
      <legend>Audio</legend>
      <div class="segmented-control">${renderAudioOptions(product.id)}</div>
    </fieldset>
    <p class="pair-status" role="status" aria-live="polite"></p>
  </div>
  <fieldset class="review-group">
    <legend>Your comparison</legend>
    <div class="review-options">${renderReviewOptions(product.id)}</div>
  </fieldset>
</article>`;
};

export function renderComparisonRows(catalog) {
  const validated = validateComparisonCatalog(catalog);
  return validated.products.map(renderProduct).join("\n");
}
