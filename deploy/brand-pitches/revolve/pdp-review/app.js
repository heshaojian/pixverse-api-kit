const posterVideos = [...document.querySelectorAll("video[data-poster]")];

const loadPoster = (video) => {
  if (!video.dataset.poster) return;
  video.poster = video.dataset.poster;
  delete video.dataset.poster;
};

const desktop = window.matchMedia("(min-width: 821px)").matches;
const eagerPosterCount = desktop ? 3 : 1;
posterVideos.slice(0, eagerPosterCount).forEach(loadPoster);

const deferred = posterVideos.slice(eagerPosterCount);
if (!("IntersectionObserver" in window)) {
  deferred.forEach(loadPoster);
} else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadPoster(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: desktop ? "500px 0px" : "200px 0px" });
  deferred.forEach((video) => observer.observe(video));
}

for (const video of document.querySelectorAll("video")) {
  video.addEventListener("error", () => {
    video.closest(".demo-media")?.classList.add("media-unavailable");
  }, { once: true });
}
