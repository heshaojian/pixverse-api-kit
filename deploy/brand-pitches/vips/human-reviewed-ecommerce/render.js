import {
  flattenCases,
  getVerdictMeta,
  isSafeMediaUrl,
  validatePitchData,
} from "./data-model.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeUrl(value) {
  if (!isSafeMediaUrl(value)) throw new Error(`Unsafe media URL: ${value}`);
  return value;
}

const slug = (value) => escapeHtml(String(value).replaceAll(/[^a-z0-9-]/g, "-"));

const renderList = (items, className) => {
  if (!items?.length) return "";
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
};

const renderVerdict = (verdict) => {
  const meta = getVerdictMeta(verdict);
  return [
    `<span class="verdict ${escapeHtml(meta.className)}">`,
    `<span aria-hidden="true">${escapeHtml(meta.symbol)}</span>`,
    `<span>${escapeHtml(meta.label)}</span>`,
    "</span>",
  ].join("");
};

const mediaLabel = (media) => {
  const typeLabel = media.type === "video" ? "评审视频" : "评审图片";
  return `${media.label}：${typeLabel}`;
};

const renderExternalMediaLink = (media) => {
  const href = escapeHtml(safeUrl(media.url));
  return [
    `<a class="media-link" href="${href}" target="_blank" rel="noreferrer">`,
    `${escapeHtml(media.label)}（打开公开参考）`,
    "</a>",
  ].join("");
};

const renderLocalImage = (media) => {
  const url = escapeHtml(safeUrl(media.url));
  return [
    `<figure class="media-frame media-frame-image" data-source-kind="${escapeHtml(media.sourceKind)}">`,
    `<img data-src="${url}" loading="lazy" decoding="async" alt="${escapeHtml(media.alt)}">`,
    `<figcaption>${escapeHtml(mediaLabel(media))}</figcaption>`,
    `<p class="media-unavailable" hidden>素材暂不可用。</p>`,
    "</figure>",
  ].join("");
};

const renderLocalVideo = (media) => {
  const url = escapeHtml(safeUrl(media.url));
  return [
    `<figure class="media-frame media-frame-video" data-source-kind="${escapeHtml(media.sourceKind)}">`,
    `<video controls playsinline preload="none" data-src="${url}" aria-label="${escapeHtml(mediaLabel(media))}"></video>`,
    `<figcaption>${escapeHtml(media.alt)}</figcaption>`,
    `<p class="media-unavailable" hidden>视频暂不可用。</p>`,
    "</figure>",
  ].join("");
};

const renderMedia = (media) => {
  if (/^https:/i.test(media.url)) return renderExternalMediaLink(media);
  return media.type === "video" ? renderLocalVideo(media) : renderLocalImage(media);
};

const renderMediaGroup = (items, title) => {
  if (!items.length) return "";
  return [
    `<div class="media-group">`,
    `<h5>${escapeHtml(title)}</h5>`,
    items.map(renderMedia).join(""),
    "</div>",
  ].join("");
};

const renderAttempt = (attempt) => {
  const prompt = attempt.prompt
    ? `<p class="attempt-prompt"><span>提示词：</span>${escapeHtml(attempt.prompt)}</p>`
    : "";
  return [
    `<li class="attempt" id="${slug(attempt.id)}">`,
    `<div class="attempt-head">`,
    `<h5>${escapeHtml(attempt.label)}</h5>`,
    renderVerdict(attempt.verdict),
    "</div>",
    `<p class="attempt-method">${escapeHtml(attempt.method)}</p>`,
    renderList(attempt.parameters, "attempt-parameters"),
    prompt,
    renderList(attempt.observations, "attempt-observations"),
    renderMediaGroup(attempt.media, "输出素材"),
    "</li>",
  ].join("");
};

export function renderCase(record) {
  return [
    `<details class="case-record" id="${slug(record.id)}">`,
    `<summary>`,
    `<span class="case-title">${escapeHtml(record.title)}</span>`,
    renderVerdict(record.review.verdict),
    `</summary>`,
    `<div class="case-body">`,
    `<p class="case-request">${escapeHtml(record.request)}</p>`,
    renderMediaGroup(record.inputs, "输入与参考"),
    `<ol class="attempts">${record.attempts.map(renderAttempt).join("")}</ol>`,
    `<details class="review-detail">`,
    `<summary>评审详情</summary>`,
    `<p>${escapeHtml(record.review.summary)}</p>`,
    renderList(record.review.observations, "review-observations"),
    `</details>`,
    `</div>`,
    `</details>`,
  ].join("");
}

export function renderChapter(chapter) {
  return [
    `<section class="ledger-chapter" id="${slug(chapter.id)}">`,
    `<header class="chapter-header">`,
    `<p class="chapter-kicker">${renderVerdict(chapter.verdict)}</p>`,
    `<h3>${escapeHtml(chapter.title)}</h3>`,
    `<p>${escapeHtml(chapter.summary)}</p>`,
    `</header>`,
    `<div class="chapter-notes">`,
    renderList(chapter.strengths, "chapter-strengths"),
    renderList(chapter.limitations, "chapter-limitations"),
    renderList(chapter.operatingConditions, "chapter-operating-conditions"),
    `</div>`,
    chapter.cases.map(renderCase).join(""),
    `</section>`,
  ].join("");
}

export function renderLedger(data) {
  const validated = validatePitchData(data);
  const records = flattenCases(validated);
  return [
    `<section class="evidence-ledger" data-case-count="${records.length}">`,
    validated.chapters.map(renderChapter).join(""),
    `</section>`,
  ].join("");
}
