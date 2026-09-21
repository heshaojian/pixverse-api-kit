import {
  flattenCases,
  getProductLinkRecords,
  getVerdictMeta,
  isSafeMediaUrl,
  isVerifiedProductUrl,
  toAttemptDomId,
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

const safeProductUrl = (value) => {
  if (!isVerifiedProductUrl(value)) throw new Error(`Invalid VIPS product URL: ${value}`);
  return value;
};

const renderProductLink = ({ url, caseTitle }, className = "case-product-link") => [
  `<a class="${escapeHtml(className)}" href="${escapeHtml(safeProductUrl(url))}" target="_blank" rel="noreferrer"`,
  ` aria-label="查看${escapeHtml(caseTitle)}的唯品会商品详情">`,
  `查看唯品会商品详情 <span aria-hidden="true">↗</span>`,
  `</a>`,
].join("");

const renderDimensions = (media) => {
  const { width, height } = media.dimensions;
  if (width === null || height === null) return "";
  return ` width="${width}" height="${height}"`;
};

const renderLocalImage = (media) => {
  const url = escapeHtml(safeUrl(media.url));
  const dimensions = renderDimensions(media);
  return [
    `<figure class="media-frame media-frame-image" data-source-kind="${escapeHtml(media.sourceKind)}">`,
    `<img data-src="${url}" loading="lazy" decoding="async"${dimensions} alt="${escapeHtml(media.alt)}">`,
    `<figcaption>${escapeHtml(mediaLabel(media))}</figcaption>`,
    `<p class="media-unavailable" hidden>素材暂不可用。</p>`,
    "</figure>",
  ].join("");
};

const renderLocalVideo = (media) => {
  const url = escapeHtml(safeUrl(media.url));
  const dimensions = renderDimensions(media);
  return [
    `<figure class="media-frame media-frame-video" data-source-kind="${escapeHtml(media.sourceKind)}">`,
    `<video controls playsinline preload="none" data-src="${url}"${dimensions} aria-label="${escapeHtml(mediaLabel(media))}"></video>`,
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

const renderAttempt = (recordId, attempt, representativeAttemptId) => {
  const prompt = attempt.prompt
    ? `<p class="attempt-prompt"><span>提示词：</span>${escapeHtml(attempt.prompt)}</p>`
    : "";
  const media = attempt.id === representativeAttemptId && attempt.media.length
    ? `<a class="representative-evidence-link" href="#${slug(recordId)}-representative-evidence">查看上方代表性结果</a>`
    : renderMediaGroup(attempt.media, "输出素材");
  return [
    `<li class="attempt" id="${slug(toAttemptDomId(recordId, attempt.id))}">`,
    `<div class="attempt-head">`,
    `<h5>${escapeHtml(attempt.label)}</h5>`,
    renderVerdict(attempt.verdict),
    "</div>",
    `<p class="attempt-method">${escapeHtml(attempt.method)}</p>`,
    renderList(attempt.parameters, "attempt-parameters"),
    prompt,
    renderList(attempt.observations, "attempt-observations"),
    media,
    "</li>",
  ].join("");
};

const findRepresentativeAttempt = (record) => [...record.attempts]
  .reverse()
  .find(({ media }) => media.length) ?? null;

export function renderCase(record) {
  const representativeAttempt = findRepresentativeAttempt(record);
  const productInput = record.inputs.find(({ type }) => type === "link");
  const productLink = productInput
    ? renderProductLink({ url: productInput.url, caseTitle: record.title })
    : "";
  const representativeEvidence = representativeAttempt
    ? [
      `<div class="representative-evidence" id="${slug(record.id)}-representative-evidence">`,
      renderMediaGroup(representativeAttempt.media, "代表性结果"),
      `</div>`,
    ].join("")
    : "";
  return [
    `<details class="case-record" id="${slug(record.id)}">`,
    `<summary>`,
    `<span class="case-title">${escapeHtml(record.title)}</span>`,
    renderVerdict(record.review.verdict),
    `</summary>`,
    `<div class="case-body">`,
    `<p class="case-request">${escapeHtml(record.request)}</p>`,
    `<p class="review-summary">${escapeHtml(record.review.summary)}</p>`,
    productLink,
    renderList(record.review.observations, "review-observations"),
    representativeEvidence,
    `<details class="complete-review-record">`,
    `<summary>完整评审记录</summary>`,
    `<div class="complete-review-body">`,
    renderMediaGroup(record.inputs, "输入与参考"),
    `<ol class="attempts">${record.attempts.map((attempt) => renderAttempt(record.id, attempt, representativeAttempt?.id)).join("")}</ol>`,
    `</div>`,
    `</details>`,
    `</div>`,
    `</details>`,
  ].join("");
}

export function renderProductDirectory(data) {
  const records = getProductLinkRecords(data);
  const groups = records.reduce((items, record) => {
    const previous = items.at(-1);
    if (previous?.chapterId === record.chapterId) {
      return Object.freeze([
        ...items.slice(0, -1),
        Object.freeze({ ...previous, records: Object.freeze([...previous.records, record]) }),
      ]);
    }
    return Object.freeze([
      ...items,
      Object.freeze({
        chapterId: record.chapterId,
        chapterTitle: record.chapterTitle,
        records: Object.freeze([record]),
      }),
    ]);
  }, Object.freeze([]));

  return [
    `<div class="product-directory" data-product-count="${records.length}">`,
    groups.map((group) => [
      `<section class="product-directory-group" aria-labelledby="product-group-${slug(group.chapterId)}">`,
      `<h3 id="product-group-${slug(group.chapterId)}">${escapeHtml(group.chapterTitle)}</h3>`,
      `<ul>`,
      group.records.map((record) => [
        `<li>`,
        `<span>${escapeHtml(record.caseTitle)}</span>`,
        renderProductLink(record, "product-directory-link"),
        `</li>`,
      ].join("")).join(""),
      `</ul>`,
      `</section>`,
    ].join("")).join(""),
    `</div>`,
  ].join("");
}

export function renderChapter(chapter) {
  return [
    `<details class="ledger-chapter" id="${slug(chapter.id)}">`,
    `<summary class="chapter-summary">`,
    `<span class="chapter-title">${escapeHtml(chapter.title)}</span>`,
    renderVerdict(chapter.verdict),
    `</summary>`,
    `<div class="chapter-body">`,
    `<p class="chapter-description">${escapeHtml(chapter.summary)}</p>`,
    `<div class="chapter-notes">`,
    renderList(chapter.strengths, "chapter-strengths"),
    renderList(chapter.limitations, "chapter-limitations"),
    renderList(chapter.operatingConditions, "chapter-operating-conditions"),
    `</div>`,
    chapter.cases.map(renderCase).join(""),
    `</div>`,
    `</details>`,
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
