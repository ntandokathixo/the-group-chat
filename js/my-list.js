document.addEventListener("DOMContentLoaded", function () {
  /* My List setup */

  const find = selector => document.querySelector(selector);
  const api = window.tmdbApi;
  const storageKey = "groupChatSavedShows";
  const realityGenre = 10764;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const loading = find("#my-list-loading");
  const skeletons = find("#my-list-skeletons");
  const errorBox = find("#my-list-error");
  const empty = find("#my-list-empty");
  const savedSection = find("#saved-shows-section");
  const grid = find("#saved-show-grid");
  const count = find("#saved-show-count");
  const confirmation = find("#remove-show-confirmation");

  let requestNumber = 0;
  let confirmationTimer;

  /* Saved shows */

  function getName(entry) {
    return typeof entry === "string" ? entry : entry?.name || "";
  }

  function getEntryKey(entry) {
    const name = getName(entry).trim().toLowerCase();
    return name ? `name:${name}` : entry?.id ? `id:${entry.id}` : "";
  }

  function readSavedShows() {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  }

  function announce(message) {
    clearTimeout(confirmationTimer);
    confirmation.hidden = false;
    confirmation.textContent = message;
    confirmationTimer = setTimeout(() => {
      confirmation.hidden = true;
    }, 3500);
  }

  function updateCount() {
    const number = grid.children.length;
    count.textContent = `${number} saved ${number === 1 ? "show" : "shows"}`;
    savedSection.hidden = number === 0;
    empty.hidden = number !== 0;
  }

  function removeShow(entry, card, name) {
    try {
      const key = getEntryKey(entry);
      const updated = readSavedShows().filter(item => getEntryKey(item) !== key);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      const nextCard = card.nextElementSibling || card.previousElementSibling;
      card.remove();
      updateCount();

      if (empty.hidden) {
        (nextCard?.querySelector("button") || find("#saved-shows-heading")).focus();
      } else {
        errorBox.hidden = true;
        find("#browse-shows").focus();
      }

      announce(`${name} was removed from My List.`);
    } catch {
      announce("This browser couldn’t remove the show from My List.");
    }
  }

  /* Find show details on TMDB */

  async function fetchSavedShow(entry) {
    if (entry?.id && /^\d+$/.test(String(entry.id))) {
      return api.getShowDetails(entry.id);
    }

    const name = getName(entry).trim();
    if (!name) return null;

    const response = await api.searchTvShows(name, 1);
    const results = Array.isArray(response) ? response : response?.results || [];

    return results.find(show =>
      show.genre_ids?.includes(realityGenre) &&
      show.name?.trim().toLowerCase() === name.toLowerCase()
    ) || null;
  }

  /* Create saved show cards */

  function createCard(entry, show) {
    const name = show?.name || getName(entry) || "Saved show";
    const id = show?.id || entry?.id;
    const card = document.createElement("article");
    card.className = "saved-show-card";

    const poster = document.createElement("div");
    poster.className = "saved-show-poster";

    const posterUrl = show?.poster_path ? api.getPosterUrl(show.poster_path) : "";
    if (posterUrl) {
      const image = document.createElement("img");
      image.src = posterUrl;
      image.alt = "";
      image.loading = "lazy";
      poster.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "saved-show-missing-poster";
      placeholder.textContent = "Poster unavailable";
      poster.append(placeholder);
    }

    const info = document.createElement("div");
    info.className = "saved-show-information";

    const title = document.createElement("h3");
    title.textContent = name;

    const meta = document.createElement("p");
    const year = (show?.first_air_date || "").slice(0, 4);
    meta.textContent = year ? `Reality TV · ${year}` : "Reality TV";

    const actions = document.createElement("div");
    actions.className = "saved-show-actions";

    const view = document.createElement("a");
    view.className = "saved-show-view-button";

    if (id) {
      view.href = `show-details.html?id=${encodeURIComponent(id)}`;
      view.textContent = "View →";
      view.setAttribute("aria-label", `View ${name}`);
    } else {
      view.href = `discover.html?${new URLSearchParams({ search: name })}`;
      view.textContent = "Find show →";
      view.setAttribute("aria-label", `Find ${name} on Discover`);
    }

    const remove = document.createElement("button");
    remove.className = "remove-saved-show-button";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${name} from My List`);
    remove.addEventListener("click", () => removeShow(entry, card, name));

    actions.append(view, remove);
    info.append(title, meta, actions);
    card.append(poster, info);
    return card;
  }

  /* Loading, error and empty states */

  async function loadMyList() {
    const request = ++requestNumber;
    errorBox.hidden = true;
    empty.hidden = true;
    savedSection.hidden = true;
    loading.hidden = true;
    grid.replaceChildren();

    let entries;

    try {
      const unique = new Map();

      for (const entry of readSavedShows()) {
        const key = getEntryKey(entry);
        if (key && !unique.has(key)) unique.set(key, entry);
      }

      entries = [...unique.values()];
    } catch {
      errorBox.hidden = false;
      return;
    }

    if (!entries.length) {
      empty.hidden = false;
      return;
    }

    skeletons.innerHTML = Array.from(
      { length: Math.min(entries.length, 8) },
      () => `
        <article class="my-list-loading-card">
          <div class="my-list-loading-image"></div>
          <div class="my-list-loading-line"></div>
        </article>
      `
    ).join("");
    loading.hidden = false;

    const results = await Promise.allSettled(entries.map(fetchSavedShow));
    if (request !== requestNumber) return;

    loading.hidden = true;
    errorBox.hidden = !results.some(result => result.status === "rejected");

    grid.replaceChildren(...results.map(function (result, index) {
      const show = result.status === "fulfilled" ? result.value : null;
      return createCard(entries[index], show);
    }));

    updateCount();

    if (!reducedMotion && window.gsap) {
      window.gsap.from(grid.querySelectorAll(".saved-show-card"), {
        opacity: 0,
        y: 16,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out"
      });
    }
  }

  find("#retry-my-list").addEventListener("click", loadMyList);

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === null) loadMyList();
  });

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) loadMyList();
  });

  loadMyList();
});