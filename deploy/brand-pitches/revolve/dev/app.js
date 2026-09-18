const catalogList = document.querySelector("#catalog-list");
const productTemplate = document.querySelector("#product-template");
const searchInput = document.querySelector("#product-search");
const typeFilter = document.querySelector("#type-filter");
const emptyState = document.querySelector("#empty-state");
const copyStatus = document.querySelector("#copy-status");

const createDefinition = (label, value) => {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
};

const showCopyStatus = (message) => {
  copyStatus.textContent = message;
  copyStatus.classList.add("visible");
  window.setTimeout(() => copyStatus.classList.remove("visible"), 1500);
};

const copyText = async (text, label) => {
  await navigator.clipboard.writeText(text);
  showCopyStatus(`${label} copied`);
};

const bindCopyButton = (button, text, label) => {
  button.addEventListener("click", async () => {
    try {
      await copyText(text, label);
    } catch {
      showCopyStatus("Copy unavailable");
    }
  });
};

const videoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
      entries
        .filter(({ isIntersecting }) => isIntersecting)
        .forEach(({ target }) => {
          target.src = target.dataset.src;
          observer.unobserve(target);
        });
    }, { rootMargin: "500px 0px" })
  : null;

const observeVideo = (video) => {
  if (videoObserver) {
    videoObserver.observe(video);
    return;
  }
  video.src = video.dataset.src;
};

const renderSettings = (container, product) => {
  const settings = [
    ["Video", product.settings.videoModel],
    ["Storyboard", product.settings.storyboardModel],
    ["Music", product.settings.musicModel],
    ["Quality", product.settings.quality],
    ["Format", product.settings.aspectRatio],
    ["Duration", `${product.settings.durationSeconds}s`],
  ];
  container.replaceChildren(...settings.map(([label, value]) => createDefinition(label, value)));
};

const renderJobs = (container, product) => {
  const jobs = [
    ["Video", String(product.jobs.video.id)],
    ["Music", String(product.jobs.music.id)],
    ["Storyboard", product.jobs.storyboard ? String(product.jobs.storyboard.id) : "Reused"],
    ["Published asset", String(product.jobs.publishedAsset.id)],
  ];
  container.replaceChildren(...jobs.map(([label, value]) => createDefinition(label, value)));
};

const renderSourceFiles = (container, product) => {
  const files = product.source.imageFiles.map((name) => {
    const tag = document.createElement("span");
    tag.textContent = name;
    return tag;
  });
  container.replaceChildren(...files);
};

const configurePromptDetail = ({ root, selector, prompt, buttonLabel }) => {
  const detail = root.querySelector(selector);
  if (!prompt) {
    detail.hidden = true;
    return;
  }

  const code = detail.querySelector("code");
  const button = detail.querySelector("button");
  code.textContent = prompt;
  bindCopyButton(button, prompt, buttonLabel);
};

const renderProduct = (product) => {
  const fragment = productTemplate.content.cloneNode(true);
  const record = fragment.querySelector(".product-record");
  const video = record.querySelector("video");
  const poster = record.querySelector(".video-poster");
  video.preload = "none";
  video.dataset.src = product.outputUrl;
  video.poster = product.posterUrl;
  video.setAttribute("aria-label", `Approved product video for ${product.productName}`);
  poster.src = product.posterUrl;
  video.addEventListener("play", () => poster.classList.add("hidden"), { once: true });
  observeVideo(video);

  record.dataset.search = `${product.productId} ${product.productName}`.toLowerCase();
  record.dataset.type = product.productType;
  record.querySelector(".record-index").textContent = String(product.displayOrder).padStart(2, "0");
  record.querySelector(".record-sku").textContent = `${product.productId} · ${product.productType}`;
  record.querySelector("h3").textContent = product.productName;

  const outputLink = record.querySelector(".output-link");
  outputLink.href = product.outputUrl;
  const productLink = record.querySelector(".product-link");
  productLink.href = product.productUrl;
  const videoJob = record.querySelector(".video-job");
  videoJob.href = product.jobs.video.url;
  const promptSource = record.querySelector(".prompt-source");
  promptSource.href = product.source.promptUrl;
  const musicSource = record.querySelector(".music-source");
  musicSource.href = product.source.musicPromptUrl;
  const commandSource = record.querySelector(".command-source");
  commandSource.href = product.source.commandUrl;
  const requestSource = record.querySelector(".request-source");
  requestSource.href = product.source.requestUrl;

  renderSettings(record.querySelector(".settings-grid"), product);
  renderJobs(record.querySelector(".job-grid"), product);
  renderSourceFiles(record.querySelector(".source-files"), product);

  configurePromptDetail({
    root: record,
    selector: ".record-detail:has(.video-prompt)",
    prompt: product.prompts.video,
    buttonLabel: "Video prompt",
  });
  configurePromptDetail({
    root: record,
    selector: ".record-detail:has(.cli-command)",
    prompt: product.cliCommand,
    buttonLabel: "Generation command",
  });
  configurePromptDetail({
    root: record,
    selector: ".music-detail",
    prompt: product.prompts.music,
    buttonLabel: "Music prompt",
  });
  configurePromptDetail({
    root: record,
    selector: ".storyboard-detail",
    prompt: product.prompts.storyboard,
    buttonLabel: "Storyboard prompt",
  });

  return record;
};

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const records = [...catalogList.querySelectorAll(".product-record")];
  const visibility = records.map((record) => {
    const matchesQuery = !query || record.dataset.search.includes(query);
    const matchesType = selectedType === "all" || record.dataset.type === selectedType;
    const visible = matchesQuery && matchesType;
    record.hidden = !visible;
    return visible;
  });
  emptyState.hidden = visibility.some(Boolean);
};

const renderWorkflow = (workflow) => {
  const steps = workflow.stages.map((stage) => {
    const item = document.createElement("li");
    item.textContent = stage;
    return item;
  });
  document.querySelector("#workflow-steps").replaceChildren(...steps);
  document.querySelector("#workflow-command").textContent = workflow.referenceCommand;
  const qaItems = workflow.qaGates.map((gate) => {
    const item = document.createElement("li");
    item.textContent = gate;
    return item;
  });
  document.querySelector("#qa-gates-list").replaceChildren(...qaItems);
  bindCopyButton(
    document.querySelector('[data-copy-source="workflow-command"]'),
    workflow.referenceCommand,
    "Reference command",
  );
};

const populateTypeFilter = (products) => {
  const types = [...new Set(products.map(({ productType }) => productType))].sort();
  const options = types.map((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    return option;
  });
  typeFilter.append(...options);
};

const response = await fetch("./catalog.json");
if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
const catalog = await response.json();

document.querySelector("#product-count").textContent = String(catalog.products.length);
renderWorkflow(catalog.workflow);
populateTypeFilter(catalog.products);
catalogList.replaceChildren(...catalog.products.map(renderProduct));
searchInput.addEventListener("input", applyFilters);
typeFilter.addEventListener("change", applyFilters);
