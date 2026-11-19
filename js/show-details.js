document.addEventListener("DOMContentLoaded", function () {
  /* Show Details setup */

  const find = selector => document.querySelector(selector);
  const api = window.tmdbApi;
  const gsap = window.gsap;
  const Draggable = window.Draggable;
  const ScrollTrigger = window.ScrollTrigger;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const params = new URLSearchParams(window.location.search);
  const showId = params.get("id") || params.get("showId");
  const storageKey = "groupChatSavedShows";
  const realityGenre = 10764;

  const loading = find("#show-details-loading");
  const errorBox = find("#show-details-error");
  const errorMessage = find("#show-error-message");
  const content = find("#show-details-content");
  const retryShow = find("#retry-show-details");
  const saveButton = find("#save-show-button");
  const saveStatus = find("#save-show-status");

  const seasonSelector = find("#season-selector");
  const seasonSelect = find("#season-select");
  const episodes = find("#episodes-list");
  const episodesLoading = find("#episodes-loading");
  const episodesEmpty = find("#episodes-empty");
  const episodesMessage = find("#episodes-message");
  const retryEpisodes = find("#retry-episodes");

  const carousel = find("#similar-shows-carousel");
  const track = find("#similar-shows-grid");
  const carouselControls = find("#similar-controls");
  const carouselNote = find("#similar-controls-note");
  const previous = find("#similar-previous");
  const next = find("#similar-next");
  const similarEmpty = find("#similar-shows-empty");
  const similarStatus = find("#similar-status");
  const retrySimilar = find("#retry-similar");

  let currentShow = null;
  let episodeRequest = 0;
  let drag = null;
  let x = 0;
  let maxOffset = 0;

  if (gsap && Draggable && !reducedMotion) gsap.registerPlugin(Draggable);
  if (gsap && ScrollTrigger && !reducedMotion) gsap.registerPlugin(ScrollTrigger);

  /* Bookmark */

  function readSavedShows() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function matchesCurrentShow(entry) {
    if (!currentShow) return false;
    return typeof entry === "string"
      ? entry === currentShow.name
      : String(entry?.id) === String(currentShow.id) || entry?.name === currentShow.name;
  }

  function paintSaveButton() {
    if (!currentShow) return;

    const saved = readSavedShows().some(matchesCurrentShow);
    saveButton.innerHTML = bookmarkIcon(saved) +
      `<span>${saved ? "Saved" : "Save Show"}</span>`;
    saveButton.classList.toggle("saved", saved);
    saveButton.setAttribute("aria-pressed", String(saved));
    saveButton.setAttribute(
      "aria-label",
      saved ? `Remove ${currentShow.name} from My List` : `Save ${currentShow.name} to My List`
    );
  }

  saveButton.addEventListener("click", function () {
    if (!currentShow) return;

    const saved = readSavedShows();
    const alreadySaved = saved.some(matchesCurrentShow);
    const updated = alreadySaved
      ? saved.filter(entry => !matchesCurrentShow(entry))
      : [...saved, currentShow.name];

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      paintSaveButton();
      saveStatus.textContent = alreadySaved ? "Removed from My List." : "Saved to My List.";
    } catch {
      saveStatus.textContent = "This browser could not update your saved shows.";
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === null) paintSaveButton();
  });

  /* Poster, title and overview */

  function addPoster(container, show, fallbackClass) {
    const url = api.getPosterUrl(show.poster_path);
    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = `${show.name || "Reality show"} poster`;
      container.replaceChildren(image);
    } else {
      const fallback = document.createElement("div");
      fallback.className = fallbackClass;
      fallback.textContent = "Poster unavailable";
      container.replaceChildren(fallback);
    }
  }

  function renderShow(show) {
    const title = show.name || "Untitled reality show";
    document.title = `${title} | The Group Chat`;
    find("#show-title").textContent = title;
    find("#show-year").textContent = (show.first_air_date || "").slice(0, 4);

    const score = Number(show.vote_average);
    find("#show-score-number").textContent =
      score > 0 ? `${Math.round(score * 10)}%` : "Not rated";

    const tagline = find("#show-tagline");
    tagline.textContent = show.tagline || "";
    tagline.hidden = !show.tagline;

    const genres = (show.genres || []).map(function (genre) {
      const label = document.createElement("span");
      label.textContent = genre.name;
      return label;
    });
    find("#show-genres").replaceChildren(...genres);

    find("#show-overview").textContent =
      show.overview || "No description is available for this show yet.";

    addPoster(find("#show-poster-container"), show, "show-details-missing-poster");
    paintSaveButton();
  }

  /* Seasons and episodes */

  function renderSeasonOptions(rawSeasons) {
    const regularSeasons = rawSeasons.filter(season => season.season_number > 0);
    const seasons = regularSeasons.length ? regularSeasons : rawSeasons;

    seasonSelect.replaceChildren(...seasons.map(function (season) {
      return new Option(season.name || `Season ${season.season_number}`, season.season_number);
    }));

    seasonSelector.hidden = !seasons.length;

    const requestedSeason = params.get("season");
    if (seasons.some(season => String(season.season_number) === requestedSeason)) {
      seasonSelect.value = requestedSeason;
    }
  }

  function makeEpisodeRow(episode) {
    const number = episode.episode_number;
    const season = episode.season_number ?? seasonSelect.value;

    const row = document.createElement("article");
    row.className = "episode-row";
    row.innerHTML = `
      <div class="episode-number" aria-hidden="true"><span>Episode</span><strong></strong></div>
      <div class="episode-information"><h3></h3></div>
      <a class="episode-view-button">View →</a>
    `;

    row.querySelector("strong").textContent = number;
    row.querySelector("h3").textContent = episode.name || `Episode ${number}`;

    const link = row.querySelector("a");
    const episodeParams = new URLSearchParams({ showId, season, episode: number });
    link.href = `episode-details.html?${episodeParams}`;
    link.setAttribute("aria-label", `View episode ${number}: ${episode.name || "Episode details"}`);
    return row;
  }

  function showEpisodeMessage(message, canRetry = false) {
    episodesMessage.textContent = message;
    episodesEmpty.hidden = false;
    retryEpisodes.hidden = !canRetry;
  }

  async function loadEpisodes() {
    const request = ++episodeRequest;
    episodes.hidden = true;
    episodes.replaceChildren();
    episodesEmpty.hidden = true;

    if (!seasonSelect.value) {
      episodesLoading.hidden = true;
      showEpisodeMessage("No seasons are available for this show yet.");
      return;
    }

    episodesLoading.hidden = false;

    try {
      const season = await api.getShowSeason(showId, Number(seasonSelect.value));
      if (request !== episodeRequest) return;

      const list = season.episodes || [];
      if (!list.length) {
        showEpisodeMessage("No episodes are listed for this season.");
        return;
      }

      episodes.replaceChildren(...list.map(makeEpisodeRow));
      episodes.hidden = false;
    } catch (error) {
      if (request !== episodeRequest) return;
      console.error("Could not load episodes:", error);
      showEpisodeMessage("This season could not load right now.", true);
    } finally {
      if (request === episodeRequest) episodesLoading.hidden = true;
    }
  }

  seasonSelect.addEventListener("change", loadEpisodes);
  retryEpisodes.addEventListener("click", loadEpisodes);

  /* Similar Shows carousel */

  function makeSimilarCard(show) {
    const card = document.createElement("article");
    card.className = "similar-show-card";

    const link = document.createElement("a");
    link.className = "similar-show-image";
    link.href = `show-details.html?id=${encodeURIComponent(show.id)}`;
    link.setAttribute("aria-label", `View ${show.name || "similar show"}`);

    addPoster(link, show, "similar-show-missing-image");
    card.append(link);
    return card;
  }

  function updateArrows() {
    previous.disabled = x >= -1;
    next.disabled = x <= -maxOffset + 1;
  }

  function moveTrack(position) {
    x = Math.min(0, Math.max(-maxOffset, position));
    track.style.transform = `translateX(${x}px)`;
    if (drag) drag.update();
    updateArrows();
  }

  function measureCarousel() {
    if (carousel.hidden) return;
    maxOffset = Math.max(0, track.scrollWidth - carousel.clientWidth);
    carouselControls.hidden = maxOffset < 2;

    if (drag) drag.applyBounds({ minX: -maxOffset, maxX: 0 });
    moveTrack(x);
  }

  function moveByCard(direction) {
    const card = track.querySelector(".similar-show-card");
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = card ? card.getBoundingClientRect().width + gap : carousel.clientWidth;
    moveTrack(x - distance * direction);
  }

  previous.addEventListener("click", () => moveByCard(-1));
  next.addEventListener("click", () => moveByCard(1));
  window.addEventListener("resize", measureCarousel);

  track.addEventListener("focusin", function (event) {
    const card = event.target.closest(".similar-show-card");
    if (!card) return;

    const view = carousel.getBoundingClientRect();
    const item = card.getBoundingClientRect();

    if (item.left < view.left) moveTrack(x + view.left - item.left);
    else if (item.right > view.right) moveTrack(x + view.right - item.right);
  });

  async function loadSimilar() {
    if (drag) {
      drag.kill();
      drag = null;
    }

    carousel.hidden = true;
    carouselControls.hidden = true;
    similarEmpty.hidden = false;
    retrySimilar.hidden = true;
    similarStatus.textContent = "Loading similar shows…";

    try {
      const response = await api.getSimilarShows(showId);
      const results = Array.isArray(response) ? response : response.results || [];
      const shows = results
        .filter(show => String(show.id) !== showId && show.genre_ids?.includes(realityGenre))
        .slice(0, 8);

      if (!shows.length) {
        similarStatus.textContent = "No similar reality shows were found.";
        return;
      }

      track.replaceChildren(...shows.map(makeSimilarCard));
      carousel.hidden = false;
      similarEmpty.hidden = true;
      x = 0;
      measureCarousel();

      if (!reducedMotion && gsap && Draggable) {
        drag = Draggable.create(track, {
          type: "x",
          bounds: { minX: -maxOffset, maxX: 0 },
          dragClickables: true,
          onDrag() {
            x = this.x;
            updateArrows();
          }
        })[0];
        carouselNote.textContent = "Drag or use the arrows";
      } else {
        carouselNote.textContent = "Use the arrows to explore";
      }
    } catch (error) {
      console.error("Could not load similar shows:", error);
      similarStatus.textContent = "Similar shows could not load right now.";
      retrySimilar.hidden = false;
    }
  }

  retrySimilar.addEventListener("click", loadSimilar);

  /* Load Show Details */

  async function loadShow() {
    loading.hidden = false;
    errorBox.hidden = true;
    content.hidden = true;

    if (!showId || !/^\d+$/.test(showId)) {
      loading.hidden = true;
      errorBox.hidden = false;
      retryShow.hidden = true;
      errorMessage.textContent = "Choose a show on Discover to see its details.";
      return;
    }

    try {
      currentShow = await api.getShowDetails(showId);
      if (!currentShow?.name) throw new Error("Show details are missing.");

      renderShow(currentShow);
      renderSeasonOptions(currentShow.seasons || []);
      loading.hidden = true;
      content.hidden = false;

      loadEpisodes();
      loadSimilar();

      if (!reducedMotion && gsap) {
        gsap.from(".show-details-hero > div", {
          opacity: 0,
          y: 22,
          stagger: 0.12,
          duration: 0.55,
          ease: "power2.out"
        });

        if (ScrollTrigger) {
          gsap.from(".show-overview-section", {
            scrollTrigger: {
              trigger: ".show-overview-section",
              start: "top 90%",
              once: true
            },
            opacity: 0,
            y: 22,
            duration: 0.5
          });
        }
      }
    } catch (error) {
      console.error("Could not load show details:", error);
      loading.hidden = true;
      content.hidden = true;
      errorBox.hidden = false;
      retryShow.hidden = false;
      errorMessage.textContent = "This show could not load right now.";
    }
  }

  retryShow.addEventListener("click", loadShow);
  loadShow();
});