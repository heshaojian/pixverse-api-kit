const EXPECTED_CHAPTER_COUNTS = Object.freeze({
  "viral-remix-and-editing": 11,
  "presenter-commerce": 3,
  "creative-commercial": 3,
  "product-motion": 9,
  "outfit-generation": 3,
});

const VERDICT_META = Object.freeze({
  capable: Object.freeze({
    label: "可胜任",
    symbol: "✓",
    className: "is-capable",
  }),
  "partially-capable": Object.freeze({
    label: "部分胜任",
    symbol: "△",
    className: "is-partial",
  }),
  "not-recommended": Object.freeze({
    label: "当前不建议直接使用",
    symbol: "×",
    className: "is-not-recommended",
  }),
  "not-evaluated": Object.freeze({
    label: "未评估",
    symbol: "○",
    className: "is-not-evaluated",
  }),
});

const SOURCE_KINDS = new Set([
  "original-input",
  "benchmark-output",
  "reference-output",
  "reviewed-output",
]);

const PRODUCT_CATALOG_EXCLUSIONS = Object.freeze(["product-motion-prompt-baseline"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const assertString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
};

const assertArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
};

const assertVerdict = (value, label) => {
  if (!Object.hasOwn(VERDICT_META, value)) throw new Error(`Invalid verdict for ${label}: ${value}`);
};

const assertUnique = (values, label) => {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
};

export function isSafeMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (/[\u0000-\u001f\u007f]/.test(value) || value.includes("\\")) return false;
  if (/^https:/i.test(value)) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return false;
  if (value.startsWith("/") || value.includes("?") || value.includes("#")) return false;
  const normalized = value.split("/").filter(Boolean).join("/");
  if (normalized !== value || normalized.startsWith("../") || value.includes("/../")) return false;
  return /^assets\/(?:images|videos)\/[a-z0-9][a-z0-9.-]*$/.test(value);
}

export function isVerifiedProductUrl(value) {
  if (!isSafeMediaUrl(value) || !/^https:/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "detail.vip.com"
      && /^\/detail-[0-9]+-[0-9]+\.html$/.test(parsed.pathname)
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}

const assertDimensions = (dimensions, label) => {
  if (!isObject(dimensions)) throw new Error(`${label}.dimensions must be an object`);
  const { width, height, aspectRatio } = dimensions;
  const validInteger = (value) => value === null || (Number.isInteger(value) && value > 0);
  if (!validInteger(width) || !validInteger(height)) throw new Error(`${label}.dimensions are invalid`);
  if (aspectRatio !== null && (typeof aspectRatio !== "number" || aspectRatio <= 0)) {
    throw new Error(`${label}.aspectRatio is invalid`);
  }
  if ((width === null) !== (height === null) || (width === null) !== (aspectRatio === null)) {
    throw new Error(`${label}.dimensions must be complete or null`);
  }
};

const assertMedia = (media, label) => {
  if (!isObject(media)) throw new Error(`${label} must be an object`);
  assertString(media.id, `${label}.id`);
  assertString(media.type, `${label}.type`);
  if (!["image", "video", "link"].includes(media.type)) throw new Error(`${label}.type is unsupported`);
  assertString(media.label, `${label}.label`);
  assertString(media.url, `${label}.url`);
  if (media.type === "link" && !isVerifiedProductUrl(media.url)) {
    throw new Error(`Invalid VIPS product URL: ${media.url}`);
  }
  if (!isSafeMediaUrl(media.url)) throw new Error(`Unsafe media URL: ${media.url}`);
  if (!SOURCE_KINDS.has(media.sourceKind)) throw new Error(`${label}.sourceKind is unsupported`);
  assertString(media.alt, `${label}.alt`);
  assertDimensions(media.dimensions, label);
};

const assertReview = (review, label) => {
  if (!isObject(review)) throw new Error(`${label} must be an object`);
  assertVerdict(review.verdict, `${label}.verdict`);
  assertString(review.summary, `${label}.summary`);
  assertArray(review.observations, `${label}.observations`);
};

const assertAttempt = (attempt, label) => {
  if (!isObject(attempt)) throw new Error(`${label} must be an object`);
  assertString(attempt.id, `${label}.id`);
  assertString(attempt.label, `${label}.label`);
  assertString(attempt.method, `${label}.method`);
  assertArray(attempt.parameters, `${label}.parameters`);
  assertArray(attempt.media, `${label}.media`);
  assertArray(attempt.observations, `${label}.observations`);
  assertVerdict(attempt.verdict, `${label}.verdict`);
  for (const [index, media] of attempt.media.entries()) {
    assertMedia(media, `${label}.media[${index}]`);
  }
};

const assertCase = (record, label) => {
  if (!isObject(record)) throw new Error(`${label} must be an object`);
  assertString(record.id, `${label}.id`);
  assertString(record.title, `${label}.title`);
  assertString(record.request, `${label}.request`);
  assertArray(record.inputs, `${label}.inputs`);
  assertArray(record.attempts, `${label}.attempts`);
  for (const [index, media] of record.inputs.entries()) {
    assertMedia(media, `${label}.inputs[${index}]`);
  }
  for (const [index, attempt] of record.attempts.entries()) {
    assertAttempt(attempt, `${label}.attempts[${index}]`);
  }
  assertReview(record.review, `${label}.review`);
};

const assertChapter = (chapter, label) => {
  if (!isObject(chapter)) throw new Error(`${label} must be an object`);
  assertString(chapter.id, `${label}.id`);
  assertString(chapter.title, `${label}.title`);
  assertVerdict(chapter.verdict, `${label}.verdict`);
  assertString(chapter.summary, `${label}.summary`);
  assertArray(chapter.cases, `${label}.cases`);
  assertArray(chapter.strengths, `${label}.strengths`);
  assertArray(chapter.limitations, `${label}.limitations`);
  assertArray(chapter.operatingConditions, `${label}.operatingConditions`);
  const expectedCount = EXPECTED_CHAPTER_COUNTS[chapter.id];
  if (chapter.cases.length !== expectedCount) {
    throw new Error(`${chapter.id} must contain ${expectedCount} cases`);
  }
  for (const [index, record] of chapter.cases.entries()) {
    assertCase(record, `${label}.cases[${index}]`);
  }
};

export function flattenCases(data) {
  validatePitchData(data);
  return Object.freeze(data.chapters.flatMap(({ cases }) => cases));
}

export function getProductLinkRecords(data) {
  const validated = validatePitchData(data);
  return Object.freeze(validated.chapters.flatMap((chapter) =>
    chapter.cases.flatMap((record) => record.inputs
      .filter(({ type }) => type === "link")
      .map(({ url }) => Object.freeze({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        caseId: record.id,
        caseTitle: record.title,
        url,
      }))),
  ));
}

const findCatalogPreviewImage = (record) => {
  const media = record.inputs.find(({ type }) => type === "image")
    ?? record.attempts.flatMap(({ media: items }) => items).find(({ type }) => type === "image")
    ?? null;
  if (!media) return null;
  return Object.freeze({
    url: media.url,
    alt: media.alt,
    width: media.dimensions.width,
    height: media.dimensions.height,
  });
};

const getCatalogMediaStatus = (record, previewImage) => {
  const hasVideo = record.attempts.some(({ media }) => media.some(({ type }) => type === "video"));
  if (hasVideo) return "已有视频";
  return previewImage ? "已有图片，视频待补充" : "视频待补充";
};

export function getProductCatalogRecords(data) {
  const validated = validatePitchData(data);
  return Object.freeze(validated.chapters.flatMap((chapter) => chapter.cases
    .filter(({ id }) => !PRODUCT_CATALOG_EXCLUSIONS.includes(id))
    .map((record) => {
      const previewImage = findCatalogPreviewImage(record);
      return Object.freeze({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        caseId: record.id,
        caseTitle: record.title,
        verdict: record.review.verdict,
        mediaStatus: getCatalogMediaStatus(record, previewImage),
        previewImage,
        productUrl: record.inputs.find(({ type }) => type === "link")?.url ?? null,
        evidenceHref: `#${record.id}`,
      });
    })));
}

export function getVerdictMeta(verdict) {
  const meta = VERDICT_META[verdict];
  if (!meta) throw new Error(`Unknown verdict: ${verdict}`);
  return meta;
}

export function getFeaturedCases(data) {
  validatePitchData(data);
  const records = new Map(flattenCases(data).map((record) => [record.id, record]));
  const featured = data.featuredCaseIds.map((id) => {
    const record = records.get(id);
    if (!record) throw new Error(`Missing featured case: ${id}`);
    return record;
  });
  return Object.freeze(featured);
}

export function toggleWorkflowSelection(selectedIds, workflowId, maxSelections = 3) {
  if (!Array.isArray(selectedIds)) throw new Error("selectedIds must be an array");
  assertString(workflowId, "workflowId");
  if (!Number.isInteger(maxSelections) || maxSelections < 1) {
    throw new Error("maxSelections must be a positive integer");
  }
  const current = Object.freeze([...selectedIds]);
  if (current.includes(workflowId)) {
    return Object.freeze({
      selectedIds: Object.freeze(current.filter((id) => id !== workflowId)),
      reason: null,
    });
  }
  if (current.length >= maxSelections) {
    return Object.freeze({ selectedIds: current, reason: "limit-reached" });
  }
  return Object.freeze({
    selectedIds: Object.freeze([...current, workflowId]),
    reason: null,
  });
}

export function buildPilotSummary({ data, selectedIds, safeguards }) {
  const validated = validatePitchData(data);
  if (!Array.isArray(selectedIds) || selectedIds.length !== 3 || new Set(selectedIds).size !== 3) {
    throw new Error("Pilot summary requires exactly three workflows");
  }
  if (!Array.isArray(safeguards) || safeguards.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("safeguards must be non-empty strings");
  }
  const selected = new Set(selectedIds);
  const workflows = validated.chapters.filter(({ id }) => selected.has(id));
  if (workflows.length !== selected.size) throw new Error("Unknown workflow selection");
  return [
    "唯品会电商视频受控试点",
    "",
    "优先工作流：",
    ...workflows.map(({ title }) => `- ${title}`),
    "",
    "共同评审边界：",
    ...safeguards.map((item) => `- ${item}`),
    "",
    `来源：人工评审材料修订版 ${validated.source.revisionId}`,
    `评审日期：${validated.source.reviewedAt}`,
  ].join("\n");
}

export function toAttemptDomId(caseId, attemptId) {
  assertString(caseId, "caseId");
  assertString(attemptId, "attemptId");
  return `${caseId}--${attemptId}`;
}

export function resolveEvidenceTarget(data, hashId) {
  const validated = validatePitchData(data);
  if (typeof hashId !== "string" || !hashId) return null;
  for (const chapter of validated.chapters) {
    if (chapter.id === hashId) {
      return Object.freeze({ chapterId: chapter.id, caseId: null, attemptDomId: null });
    }
    for (const record of chapter.cases) {
      if (record.id === hashId) {
        return Object.freeze({ chapterId: chapter.id, caseId: record.id, attemptDomId: null });
      }
      for (const attempt of record.attempts) {
        const attemptDomId = toAttemptDomId(record.id, attempt.id);
        if (attemptDomId === hashId) {
          return Object.freeze({ chapterId: chapter.id, caseId: record.id, attemptDomId });
        }
      }
    }
  }
  return null;
}

export function validatePitchData(data) {
  if (!isObject(data)) throw new Error("Pitch data must be an object");
  if (data.schemaVersion !== "vips-pitch.v1") throw new Error("Unsupported schemaVersion");
  if (data.source?.revisionId !== 1214) throw new Error("Expected revision 1214");
  if (data.source.productLinkRevisionId !== 5) throw new Error("Expected product-link revision 5");
  assertArray(data.featuredCaseIds, "featuredCaseIds");
  assertUnique(data.featuredCaseIds, "featured case id");
  assertArray(data.chapters, "chapters");
  const chapterIds = data.chapters.map(({ id }) => id);
  assertUnique(chapterIds, "chapter id");
  if (JSON.stringify(chapterIds) !== JSON.stringify(Object.keys(EXPECTED_CHAPTER_COUNTS))) {
    throw new Error("Unexpected chapter order");
  }
  for (const [index, chapter] of data.chapters.entries()) {
    assertChapter(chapter, `chapters[${index}]`);
  }
  const caseIds = flattenRawCases(data).map(({ id }) => id);
  assertUnique(caseIds, "case id");
  const caseIdSet = new Set(caseIds);
  for (const id of data.featuredCaseIds) {
    if (!caseIdSet.has(id)) throw new Error(`Missing featured case: ${id}`);
  }
  return Object.freeze({
    ...data,
    featuredCaseIds: Object.freeze([...data.featuredCaseIds]),
    chapters: Object.freeze([...data.chapters]),
  });
}

function flattenRawCases(data) {
  return data.chapters.flatMap(({ cases }) => cases);
}
