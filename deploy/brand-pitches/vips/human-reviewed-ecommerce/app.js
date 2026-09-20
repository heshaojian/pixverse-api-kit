import {
  buildPilotSummary,
  resolveEvidenceTarget,
  toggleWorkflowSelection,
  validatePitchData,
} from "./data-model.js";
import { renderLedger } from "./render.js";

const DATA_URL = "./data/cases.json";
const FAILURE_MESSAGE = "完整评审暂不可用，请稍后重试。";
const FEATURED_POSTER_PATHS = new Set([
  "./assets/images/featured-presenter-poster.jpg",
  "./assets/images/featured-creative-poster.jpg",
]);
const PILOT_SAFEGUARDS = Object.freeze([
  "确认优先商品、可用素材与渠道版式。",
  "确认必须保持准确的商品细节、文字、Logo 与动作边界。",
  "确认人工评审打分表、关键失败规则与可接受的重生成次数。",
  "用同一套标准比较产出质量、评审耗时和返工原因。",
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
  if (element.dataset.poster) element.setAttribute("poster", element.dataset.poster);
  if (element.dataset.src) element.setAttribute("src", element.dataset.src);
  if (element.tagName === "VIDEO") element.load();
};

const isInsideClosedDisclosure = (element) => Boolean(element.closest?.("details:not([open])"));

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
      if (!entry.isIntersecting || isInsideClosedDisclosure(entry.target)) continue;
      attachOneDeferredMedia(entry.target);
      observer.unobserve(entry.target);
    }
  });
  const observed = new WeakSet();
  const observeVisible = (scope) => {
    for (const element of scope.querySelectorAll("[data-src]")) {
      if (observed.has(element) || isInsideClosedDisclosure(element)) continue;
      observed.add(element);
      observer.observe(element);
    }
  };
  observeVisible(root);
  for (const detail of root.querySelectorAll("details")) {
    detail.addEventListener("toggle", () => {
      if (detail.open) observeVisible(detail);
    });
  }
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

const decodeHash = (hash) => {
  if (!hash || hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
};

export function openEvidenceTarget({
  root,
  data,
  hash,
  escapeSelector = (value) => CSS.escape(value),
}) {
  const hashId = decodeHash(hash);
  if (!hashId) return false;
  const plan = resolveEvidenceTarget(data, hashId);
  if (!plan) return false;
  const find = (id) => root.querySelector(`#${escapeSelector(id)}`);
  const chapter = find(plan.chapterId);
  if (!chapter) return false;
  chapter.open = true;
  let focusTarget = chapter;
  if (plan.caseId) {
    const record = find(plan.caseId);
    if (!record) return false;
    record.open = true;
    focusTarget = record;
  }
  if (plan.attemptDomId) {
    const attempt = find(plan.attemptDomId);
    if (!attempt) return false;
    const completeRecord = attempt.closest?.(".complete-review-record");
    if (completeRecord) completeRecord.open = true;
    focusTarget = attempt;
  }
  focusTarget.querySelector?.("summary")?.focus?.({ preventScroll: true });
  return true;
}

const requiredPilotNodes = (documentRef) => Object.freeze({
  count: documentRef.getElementById("selection-count"),
  limit: documentRef.getElementById("selection-limit-message"),
  summary: documentRef.getElementById("pilot-summary"),
  copy: documentRef.getElementById("copy-pilot"),
  status: documentRef.getElementById("copy-status"),
  manual: documentRef.getElementById("manual-copy"),
});

export function attachPilotSelector({ documentRef, data, clipboard = globalThis.navigator?.clipboard }) {
  const inputs = Object.freeze([...documentRef.querySelectorAll('input[name="pilot-workflow"]')]);
  const nodes = requiredPilotNodes(documentRef);
  if (!inputs.length || Object.values(nodes).some((node) => !node)) return () => {};
  let selectedIds = Object.freeze(inputs.filter(({ checked }) => checked).map(({ value }) => value));

  const render = () => {
    const selected = new Set(selectedIds);
    for (const input of inputs) input.checked = selected.has(input.value);
    nodes.count.textContent = `已选择 ${selectedIds.length} / 3`;
    nodes.copy.disabled = selectedIds.length !== 3;
    nodes.summary.textContent = selectedIds.length === 3
      ? buildPilotSummary({ data, selectedIds, safeguards: PILOT_SAFEGUARDS })
      : "选择三类工作流后，这里会生成试点摘要。";
  };

  const onChange = (event) => {
    const next = toggleWorkflowSelection(selectedIds, event.currentTarget.value);
    selectedIds = next.selectedIds;
    nodes.limit.textContent = next.reason === "limit-reached"
      ? "最多选择三类工作流；请先取消一项。"
      : "";
    render();
  };

  const onCopy = async () => {
    if (selectedIds.length !== 3) return;
    const summary = nodes.summary.textContent;
    try {
      if (typeof clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
      await clipboard.writeText(summary);
      nodes.manual.hidden = true;
      nodes.status.textContent = "试点方案已复制。";
    } catch {
      nodes.manual.hidden = false;
      nodes.manual.value = summary;
      nodes.manual.focus();
      nodes.manual.select();
      nodes.status.textContent = "无法自动复制，请使用下方文本手动复制。";
    }
  };

  for (const input of inputs) input.addEventListener("change", onChange);
  nodes.copy.addEventListener("click", onCopy);
  render();
  return () => {
    for (const input of inputs) input.removeEventListener("change", onChange);
    nodes.copy.removeEventListener("click", onCopy);
  };
}

export function renderLedgerInto({ mount, fallback, data, hash = globalThis.location?.hash ?? "" }) {
  const validated = validatePitchData(data);
  const markup = renderLedger(validated);
  const template = document.createElement("template");
  const fragment = document.createRange().createContextualFragment(markup);
  template.content.replaceChildren(fragment);
  mount.replaceChildren(template.content.cloneNode(true));
  if (fallback) fallback.hidden = true;
  attachDeferredMedia(mount);
  openEvidenceTarget({ root: mount, data: validated, hash });
}

const showLedgerFailure = (fallback, retry) => {
  if (!fallback) return;
  fallback.hidden = false;
  const message = fallback.querySelector("p");
  if (message) message.textContent = FAILURE_MESSAGE;
  if (retry) retry.hidden = false;
};

export async function initPitchPage({
  documentRef = document,
  fetchImpl = fetch,
  windowRef = window,
  clipboard = globalThis.navigator?.clipboard,
} = {}) {
  attachDesktopPosters(documentRef);
  const mount = documentRef.querySelector("#ledger-mount");
  const fallback = documentRef.querySelector(".ledger-fallback");
  const retry = documentRef.getElementById("ledger-retry");
  if (!mount) return;
  let pitchData = null;
  let pilotCleanup = null;
  let hashListenerAttached = false;

  const handleHash = () => {
    if (pitchData) openEvidenceTarget({ root: mount, data: pitchData, hash: windowRef.location.hash });
  };
  const load = async () => {
    if (retry) retry.disabled = true;
    try {
      pitchData = await loadPitchData(fetchImpl);
      renderLedgerInto({ mount, fallback, data: pitchData, hash: windowRef.location.hash });
      if (!pilotCleanup) pilotCleanup = attachPilotSelector({ documentRef, data: pitchData, clipboard });
      if (retry) {
        retry.hidden = true;
        retry.disabled = false;
      }
      if (!hashListenerAttached) {
        windowRef.addEventListener("hashchange", handleHash);
        hashListenerAttached = true;
      }
    } catch {
      if (retry) retry.disabled = false;
      showLedgerFailure(fallback, retry);
    }
  };
  retry?.addEventListener("click", load);
  await load();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initPitchPage(), { once: true });
  } else {
    initPitchPage();
  }
}
