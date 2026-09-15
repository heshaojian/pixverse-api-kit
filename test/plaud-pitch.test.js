import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const pitchPath = new URL("../deploy/brand-pitches/plaud/plaud-pixverse-0914/index.html", import.meta.url);

const formatVideos = Object.freeze([
  Object.freeze({
    label: "Product Page Motion",
    videoUrl: "https://media.pixverse.ai/pixverse/mp4/media/workflow-studio/concat_8157_20260911T211419Z_final_concat.mp4",
    posterUrl: "https://media.pixverse.ai/marketing_hub_website/first_frames/pixverse/mp4/media/workflow-studio/concat_8157_20260911T211419Z_final_concat.mp4_first_frame.jpg",
  }),
  Object.freeze({
    label: "Performance / Social Ads",
    videoUrl: "https://media.pixverse.ai/pixverse/mp4/media/workflow-studio/concat_8158_20260911T211312Z_final_concat.mp4",
    posterUrl: "https://media.pixverse.ai/marketing_hub_website/first_frames/pixverse/mp4/media/workflow-studio/concat_8158_20260911T211312Z_final_concat.mp4_first_frame.jpg",
  }),
  Object.freeze({
    label: "Premium Launch Films",
    videoUrl: "https://media.pixverse.ai/pixverse/mp4/media/workflow-studio/concat_8159_20260911T211322Z_final_concat.mp4",
    posterUrl: "https://media.pixverse.ai/marketing_hub_website/first_frames/pixverse/mp4/media/workflow-studio/concat_8159_20260911T211322Z_final_concat.mp4_first_frame.jpg",
  }),
]);

const expectedVideoUrls = Object.freeze([
  ...formatVideos.map(({ videoUrl }) => videoUrl),
]);

const publicReferences = Object.freeze([
  "https://www.plaud.ai/pages/shop-plaud?ref=banner_cta",
  "https://www.plaud.ai/",
  "https://www.plaud.ai/pages/plaud-note-user-guide-video",
  "https://www.reddit.com/r/PLAUDAI/comments/1q3wces/official_launch_seamless_capture_across_every/",
  "https://sea.plaud.ai/",
  "https://www.dapperandgroomed.com/blog/plaud-notepin-s-review-the-wearable-ai-note-taker-for-meetings-calls-amp-ideas",
]);

const expectedProducts = Object.freeze([
  Object.freeze({ name: "Plaud Note Pro", path: "/products/plaud-note-pro" }),
  Object.freeze({ name: "Plaud Note", path: "/products/plaud-note-ai-voice-recorder" }),
  Object.freeze({ name: "Plaud NotePin S", path: "/products/plaud-notepin-s" }),
  Object.freeze({ name: "Plaud NotePin", path: "/products/plaud-notepin" }),
  Object.freeze({ name: "Plaud One", path: "/products/plaud-one" }),
]);

const readPitch = () => fs.readFile(pitchPath, "utf8");

const getSection = (html, id) => {
  const match = html.match(new RegExp(`<section\\b(?=[^>]*\\bid="${id}")[^>]*>[\\s\\S]*?<\\/section>`, "i"));
  assert.ok(match, `missing #${id} section`);
  return match[0];
};

const getSectionPosition = (html, id) =>
  html.search(new RegExp(`<section\\b(?=[^>]*\\bid="${id}")[^>]*>`, "i"));

const getVisibleText = (html) =>
  html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|nbsp|copy|reg|rarr);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const getCustomerFacingAttributes = (html) =>
  [...html.matchAll(/\b(?:alt|aria-label|title|placeholder)="([^"]*)"/gi)]
    .map(([, value]) => value)
    .join(" ");

const getArticlesByClass = (html, className) =>
  [...html.matchAll(new RegExp(`<article\\b(?=[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*")[^>]*>[\\s\\S]*?<\\/article>`, "gi"))]
    .map(([article]) => article);

test("Plaud pitch follows a proof-first customer story", async () => {
  const html = await readPitch();
  const hero = getSection(html, "hero");
  const sectionIds = Object.freeze(["formats", "signals", "hardware", "pilot"]);
  const positions = sectionIds.map((id) => getSectionPosition(html, id));

  assert.match(hero, /<h1\b[^>]*>[\s\S]*?Plaud[\s\S]*?<\/h1>/i);
  assert.doesNotMatch(hero, /<video\b/i, "hero should lead with strategy, not a weak concept video");
  assert.match(getVisibleText(hero), /public product proof[^.]{0,80}videos that sell/i);
  assert.match(getVisibleText(hero), /Plaud[^.]{0,120}\b(?:hardware|device|product)\b/i);
  assert.match(getVisibleText(hero), /(?:public|existing)[^.]{0,100}\b(?:proof|videos?)\b/i);
  positions.forEach((position, index) => {
    assert.ok(position >= 0, `missing #${sectionIds[index]} section`);
    if (index > 0) {
      assert.ok(position > positions[index - 1], `#${sectionIds[index]} is out of story order`);
    }
  });
});

test("Plaud pitch keeps the hero free of weak concept video", async () => {
  const html = await readPitch();
  const hero = getSection(html, "hero");
  const heroVideo = hero.match(/<video\b[^>]*>[\s\S]*?<\/video>/i)?.[0] ?? "";

  assert.equal(heroVideo, "", "hero should not lead with the weaker combined concept reel");
  assert.doesNotMatch(getVisibleText(hero), /hardware growth sample/i);
  assert.match(getVisibleText(hero), /product-page[^.]{0,80}paid-social[^.]{0,80}launch video/i);
  assert.doesNotMatch(getVisibleText(hero), /three-format|three formats|continuous reel/i);
  assert.doesNotMatch(html, /plaud-notepin-s-three-format-reel-30s/i);
});

test("Plaud pitch translates public references into three differentiated formats", async () => {
  const html = await readPitch();
  const formats = getSection(html, "formats");
  const formatCards = getArticlesByClass(formats, "format-card");

  assert.match(getVisibleText(formats), /Plaud’s current video language/i);
  assert.equal(formatCards.length, 3, "reference map must contain exactly three format cards");

  formatVideos.forEach(({ label, videoUrl, posterUrl }, index) => {
    const card = formatCards[index] ?? "";
    const videoTag = card.match(/<video\b[^>]*>/i)?.[0] ?? "";

    assert.match(getVisibleText(card), new RegExp(label.replace(" / ", " \\/ "), "i"));
    assert.ok(card.includes(`<source src="${videoUrl}" type="video/mp4">`), `${label} must use its approved video`);
    assert.ok(videoTag.includes(`poster="${posterUrl}"`), `${label} must use its approved poster`);
    assert.match(videoTag, /\bpreload="none"/i);
    assert.match(getVisibleText(card), /Draft sample/i);
    assert.doesNotMatch(getVisibleText(card), /PixVerse format/i);
  });

  assert.match(getVisibleText(formatCards[0]), /\b(?:calm|measured|inspection|detail)\b/i);
  assert.match(getVisibleText(formatCards[0]), /PDP engagement|add-to-cart|conversion/i);
  assert.match(getVisibleText(formatCards[1]), /\b(?:fast|hook|scroll|action)\b/i);
  assert.match(getVisibleText(formatCards[1]), /thumb-stop|CTR|ROAS/i);
  assert.match(getVisibleText(formatCards[2]), /\b(?:premium|cinematic|reveal|launch)\b/i);
  assert.match(getVisibleText(formatCards[2]), /launch attention|brand consideration|sell-in/i);
});

test("Plaud pitch links the six public reference sources safely", async () => {
  const html = await readPitch();

  publicReferences.forEach((url) => {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const link = html.match(new RegExp(`<a\\b(?=[^>]*href="${escaped}")(?=[^>]*target="_blank")(?=[^>]*rel="noreferrer")[^>]*>`, "i"));
    assert.ok(link, `missing safe public reference link: ${url}`);
  });
});

test("Plaud pitch distills the five public-video rules", async () => {
  const html = await readPitch();
  const signals = getSection(html, "signals");
  const signalItems = getArticlesByClass(signals, "signal-item");
  const text = getVisibleText(signals);

  assert.equal(signalItems.length, 5, "signals section must contain exactly five rules");
  assert.match(text, /hardware[^.]{0,100}(?:in hand|worn|on (?:the )?phone)/i);
  assert.match(text, /recording action[^.]{0,100}(?:obvious|clear|unmistakable)/i);
  assert.match(text, /workplace context[^.]{0,100}(?:abstract|abstraction)/i);
  assert.match(text, /(?:privacy|consent)[^.]{0,100}(?:trust|recording|reminder)/i);
  assert.match(text, /creators?[^.]{0,100}(?:scale|use cases?)/i);
});

test("Plaud pitch keeps the hardware family exact and excludes software offers", async () => {
  const html = await readPitch();
  const hardware = getSection(html, "hardware");
  const productCards = [...hardware.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bproduct-card\b[^"]*")[^>]*>[\s\S]*?<\/a>/gi)]
    .map(([card]) => card);

  assert.equal(productCards.length, 5, "hardware range must contain exactly five products");
  expectedProducts.forEach(({ name, path }) => {
    assert.match(getVisibleText(hardware), new RegExp(`\\b${name}\\b`, "i"));
    assert.match(hardware, new RegExp(`href="https:\\/\\/www\\.plaud\\.ai${path}(?:[?#][^"]*)?"`, "i"));
  });

  assert.doesNotMatch(getVisibleText(html), /\b(?:Plaud Intelligence|Ask Plaud|templates?|subscription plans?|software|artificial intelligence|generative)\b/i);
});

test("Plaud pitch preserves all concept media and labels its provenance", async () => {
  const html = await readPitch();
  const sourceUrls = new Set(
    [...html.matchAll(/<source\b[^>]*\bsrc="([^"]+)"/gi)].map(([, src]) => src),
  );

  assert.deepEqual(sourceUrls, new Set(expectedVideoUrls));
  assert.doesNotMatch(html, /id="proof"/i);
  assert.equal((getVisibleText(html).match(/Draft sample/gi) ?? []).length, 3);
  assert.match(getVisibleText(html), /not official Plaud (?:work|videos?|footage)/i);
});

test("Plaud pitch loads one flagship preview and defers every other video", async () => {
  const html = await readPitch();
  const videos = [...html.matchAll(/<video\b[^>]*>/gi)].map(([tag]) => tag);

  assert.equal(videos.length, 3, "only the three channel-plan samples should remain");
  videos.forEach((video) => assert.match(video, /\bpreload="none"/i));
  assert.equal((html.match(/\bpreload="metadata"/gi) ?? []).length, 0);
  assert.equal((html.match(/\bpreload="none"/gi) ?? []).length, videos.length);
  assert.doesNotMatch(html, /<video\b[^>]*\b(?:autoplay|preload="auto")/i);
  videos.forEach((video) => {
    assert.match(video, /\bcontrols\b/i);
    assert.match(video, /\bplaysinline\b/i);
    assert.match(video, /\bposter="https:\/\/[^"]+"/i);
    assert.match(video, /\baria-label="[^"]+"/i);
  });
});

test("Plaud pitch closes on one focused pilot action", async () => {
  const html = await readPitch();
  const pilot = getSection(html, "pilot");
  const actions = [...html.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bbtn\b[^"]*")[^>]*>[\s\S]*?<\/a>/gi)];
  const gradientActions = [...pilot.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bgradient\b[^"]*")[^>]*>[\s\S]*?<\/a>/gi)];

  assert.equal(gradientActions.length, 1, "the page should have one primary pilot action");
  assert.match(gradientActions[0][0], /href="mailto:[^"]+"/i);
  assert.match(getVisibleText(gradientActions[0][0]), /Plaud video pilot/i);
  assert.match(getVisibleText(pilot), /\bone\b[^.]{0,80}\b(?:priority )?device\b/i);
  assert.match(getVisibleText(pilot), /\bthree\b[^.]{0,80}\bformats?\b/i);
  assert.ok(actions.length <= 2, "secondary navigation should not compete with the pilot action");
});

test("Plaud pitch keeps responsive, accessible, and design-system safeguards", async () => {
  const html = await readPitch();
  const nav = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? "";
  const targetIds = [...nav.matchAll(/href="#([^"]+)"/gi)].map(([, id]) => id);
  const scrollMargins = [...html.matchAll(/scroll-margin-top:\s*(\d+)px\s*;/gi)]
    .map(([, pixels]) => Number(pixels));
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => tag);

  assert.match(html, /<body\b[^>]*\bid="page-top"/i);
  assert.match(html, /<a\b(?=[^>]*\bclass="[^"]*\bbrand\b[^"]*")(?=[^>]*\bhref="#page-top")[^>]*>/i);
  assert.ok(targetIds.length >= 4);
  targetIds.forEach((id) => assert.match(html, new RegExp(`<[^>]+\\bid="${id}"[^>]*>`, "i")));
  assert.ok(scrollMargins.length >= 1);
  assert.ok(Math.min(...scrollMargins) >= 120);
  images.forEach((image) => {
    assert.match(image, /\balt="[^"]*"/i);
    assert.match(image, /\bwidth="\d+"/i);
    assert.match(image, /\bheight="\d+"/i);
  });
  assert.match(html, /:focus-visible\s*\{/i);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(html, /min-height:\s*44px/i);
  assert.match(html, /--bg:\s*#000(?:000)?\s*;/i);
  assert.match(html, /--create:\s*linear-gradient\(/i);
  assert.match(html, /Plus Jakarta Sans/i);
  assert.match(html, /Inconsolata/i);
  assert.match(html, /color-scheme:\s*dark/i);
  assert.match(html, /backdrop-filter:\s*blur\(/i);
  assert.doesNotMatch(html, /box-shadow\s*:/i);
});

test("Plaud pitch exposes only customer-ready language", async () => {
  const html = await readPitch();
  const visibleText = getVisibleText(html);
  const accessibleText = getCustomerFacingAttributes(html);
  const forbiddenLanguage = Object.freeze([
    /\b(?:key|strategic)[ -]account\b|\bofficial partner(?:ship)?\b/i,
    /\b(?:generate|generated|generation|workflow|pipeline|prompt|payload|job ID|model name|creative brief|quality pass)\b/i,
    /\b(?:API defaults?|API request|avatar mode|voiceover|captions?|aspect ratio|resolution|1080p|9:16|preload|processing|output URL)\b/i,
    /\b(?:research dossier|research memo|internal notes?|implementation mechanics?)\b/i,
    /\b(?:mobile app|web app|cloud subscription)\b/i,
  ]);

  assert.match(visibleText, /\bPlaud hardware\b/i);
  assert.match(html, /<meta\b(?=[^>]*name="robots")(?=[^>]*content="noindex, nofollow")[^>]*>/i);
  forbiddenLanguage.forEach((pattern) => {
    assert.doesNotMatch(visibleText, pattern);
    assert.doesNotMatch(accessibleText, pattern);
  });
});
