document.addEventListener("DOMContentLoaded", function () {
  /* Discover setup */

  const REALITY_GENRE_ID = 10764;
  const STORAGE_KEY = "groupChatSavedShows";
  const genreNames = {
    18: "Drama",
    35: "Comedy",
    99: "Documentary",
    10751: "Family",
    9648: "Mystery",
    10764: "Reality"
  };

  /* Home category collections */

const categories = {
  romance: {
    label: "Romance",
    shows: ["Love Island", "Love Is Blind", "The Bachelor", "Perfect Match"]
  },
  luxury: {
    label: "Luxury",
    shows: ["Dubai Bling", "Selling Sunset", "Bling Empire", "The Kardashians"]
  },
  food: {
    label: "Food",
    shows: ["Top Chef", "MasterChef", "Hell's Kitchen", "The Great British Bake Off"]
  },
  competition: {
    label: "Competition",
    shows: ["Survivor", "The Amazing Race", "The Traitors", "RuPaul's Drag Race"]
  }
};

  const form = document.querySelector("#discover-search-form");
  const search = document.querySelector("#discover-search");
  const controls = {
    genre: document.querySelector("#genre-filter"),
    rating: document.querySelector("#rating-filter"),
    year: document.querySelector("#year-filter")
  };
  const activeFilters = document.querySelector("#active-filters-list");
  const clearButton = document.querySelector("#clear-filters");
  const grid = document.querySelector("#discover-grid");
  const heading = document.querySelector("#discover-result-title");
  const count = document.querySelector("#discover-result-count");
  const pagination = document.querySelector("#discover-pagination");
  const previous = document.querySelector("#previous-page");
  const next = document.querySelector("#next-page");
  const pageNumber = document.querySelector("#page-number");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const filters = { search: "", genre: "", rating: "", year: "", category: "" };
  let page = 1;
  let totalPages = 1;
  let requestNumber = 0;

  /* Active filters and page URL */

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    filters.category = Object.hasOwn(categories, category) ? category : "";
    filters.search = (params.get("search") || "").trim();
    search.value = filters.search;

    for (const [name, control] of Object.entries(controls)) {
      control.value = params.get(name) || "";
      filters[name] = control.value;
    }

    const requestedPage = Number(params.get("page"));
    page = Number.isInteger(requestedPage)
      ? Math.min(500, Math.max(1, requestedPage))
      : 1;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(filters)) {
      if (value) {
        url.searchParams.set(name, value);
      } else {
        url.searchParams.delete(name);
      }
    }

    if (page > 1) {
      url.searchParams.set("page", page);
    } else {
      url.searchParams.delete("page");
    }

    window.history.replaceState({}, "", url);
  }


  function renderActiveFilters() {
    activeFilters.replaceChildren();

    for (const [name, value] of Object.entries(filters)) {
      if (!value) continue;

      const label = name === "search"
  ? `“${value}”`
  : name === "category"
    ? categories[value].label
    : controls[name].selectedOptions[0].textContent;

      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "active-filter-pill";
      pill.setAttribute("aria-label", `Remove ${label} filter`);

      const text = document.createElement("span");
      text.textContent = label;

      const cross = document.createElement("span");
      cross.textContent = "×";
      cross.setAttribute("aria-hidden", "true");
      pill.append(text, cross);

      pill.addEventListener("click", function () {
      filters[name] = "";
      const control = name === "search" ? search : controls[name];

      if (control) control.value = "";

      page = 1;
      loadShows();
      (control || search).focus();
      });

      activeFilters.append(pill);
    }

    clearButton.hidden = !activeFilters.children.length;

    if (clearButton.hidden) {
      const note = document.createElement("span");
      note.className = "no-active-filters";
      note.textContent = "None yet";
      activeFilters.append(note);
    }
  }


  function clearFilters() {
    search.value = "";
    filters.search = "";
    filters.category = "";

    for (const [name, control] of Object.entries(controls)) {
      control.value = "";
      filters[name] = "";
    }

    page = 1;
    loadShows();
    search.focus();
  }



  /* Saved shows and bookmark buttons */

  function getSavedShows() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function matchesSavedShow(entry, showName) {
    return (typeof entry === "string" ? entry : entry?.name) === showName;
  }

  function paintBookmark(button, showName, saved) {
    button.classList.toggle("saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute(
      "aria-label",
      saved ? `Remove ${showName} from My List` : `Save ${showName} to My List`
    );

    button.innerHTML = `
      <svg class="bookmark-icon" viewBox="0 0 24 28" aria-hidden="true">
        <path d="M3 2.5h18v23l-9-6-9 6z"
          fill="${saved ? "currentColor" : "none"}"
          stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
    `;
  }



  /* Discover cards */

  function createCard(show) {
    const showName = show.name || "Untitled reality show";
    const detailsUrl = `show-details.html?id=${encodeURIComponent(show.id)}`;
    const card = document.createElement("article");
    card.className = "show-card";
    card.innerHTML = `
      <a class="show-card-poster"></a>
      <div class="show-card-content">
        <h3></h3>
        <p class="show-card-tags"></p>
        <p class="show-card-description"></p>
        <div class="show-card-actions">
          <a class="small-black-button">View Show →</a>
          <button class="show-save-button" type="button"></button>
        </div>
      </div>
    `;

    const posterLink = card.querySelector(".show-card-poster");
    posterLink.href = detailsUrl;
    posterLink.setAttribute("aria-label", `View ${showName}`);

    const posterUrl = window.tmdbApi.getPosterUrl(show.poster_path);
    if (posterUrl) {
      const image = document.createElement("img");
      image.className = "show-card-image";
      image.src = posterUrl;
      image.alt = "";
      image.loading = "lazy";
      posterLink.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "show-card-image show-card-image-missing";
      placeholder.textContent = "Poster unavailable";
      posterLink.append(placeholder);
    }

    const tags = (show.genre_ids || [])
      .map(id => genreNames[id])
      .filter(Boolean)
      .slice(0, 3);

    card.querySelector("h3").textContent = showName;
    card.querySelector(".show-card-tags").textContent = tags.join(" · ") || "Reality TV";
    card.querySelector(".show-card-description").textContent =
      show.overview || "No description is available yet.";

    const viewLink = card.querySelector(".small-black-button");
    viewLink.href = detailsUrl;
    viewLink.setAttribute("aria-label", `View ${showName}`);

    const bookmark = card.querySelector(".show-save-button");
    paintBookmark(
      bookmark,
      showName,
      getSavedShows().some(entry => matchesSavedShow(entry, showName))
    );

    bookmark.addEventListener("click", function () {
      const list = getSavedShows();
      const alreadySaved = list.some(entry => matchesSavedShow(entry, showName));
      const updatedList = alreadySaved
        ? list.filter(entry => !matchesSavedShow(entry, showName))
        : [...list, showName];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
        paintBookmark(bookmark, showName, !alreadySaved);
      } catch {
        count.textContent = "This browser could not update your saved shows.";
      }
    });

    return card;
  }



  /* Loading, error and empty states */

  function showLoading() {
    grid.setAttribute("aria-busy", "true");
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <article class="show-card loading-card" aria-hidden="true">
        <div class="loading-image"></div>
        <div class="show-card-content">
          <div class="loading-line loading-line-long"></div>
          <div class="loading-line loading-line-short"></div>
        </div>
      </article>
    `).join("");
    count.textContent = "Loading reality shows...";
  }

  function showMessage(message, buttonText, action) {
    const box = document.createElement("div");
    box.className = "api-state discover-api-state";

    const text = document.createElement("p");
    text.textContent = message;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = buttonText;
    button.addEventListener("click", action);
    box.append(text, button);

    grid.replaceChildren(box);
  }



  /* Reality TV filtering and pagination */

  function matchesFilters(show) {
    const genres = Array.isArray(show.genre_ids)
    ? show.genre_ids
    : (show.genres || []).map(genre => genre.id);

    if (!genres.includes(REALITY_GENRE_ID)) return false;
    if (filters.genre && !genres.includes(Number(filters.genre))) return false;
    if (filters.rating && !(Number(show.vote_average) >= Number(filters.rating))) {
      return false;
    }

    if (filters.year) {
      const [start, end] = filters.year.split("-").map(Number);
      const year = Number((show.first_air_date || "").slice(0, 4));
      if (year < start || year > end) return false;
    }

    return true;
  }

  function updatePagination() {
    pageNumber.textContent = `Page ${page}`;
    previous.disabled = page <= 1;
    next.disabled = page >= totalPages;
    pagination.hidden = totalPages <= 1 && page <= 1;
  }

  async function loadShows() {
    const thisRequest = ++requestNumber;
    updateUrl();
    renderActiveFilters();

    heading.textContent = filters.search
    ? `Results for “${filters.search}”`
    : filters.category
    ? `${categories[filters.category].label} Reality Shows`
    : filters.genre
      ? `${genreNames[filters.genre]} Reality Shows`
      : "All Reality TV";

    showLoading();

    try {
      const api = window.tmdbApi;
      const response = filters.search
      ? await api.searchTvShows(filters.search, page)
      : filters.category
    ? {
        results: await api.getShowsByNames(categories[filters.category].shows),
        total_pages: 1
      }
    : await api.discoverTvShows({
        genre: filters.genre,
        sortBy: "popularity.desc",
        page
      });

      if (thisRequest !== requestNumber) return;

      totalPages = Math.min(500, Number(response.total_pages) || 1);
      const shows = (response.results || []).filter(matchesFilters);

      if (!shows.length) {
        count.textContent = "No matching shows on this page.";
        const morePages = page < totalPages;
        showMessage(
          morePages
            ? "No matches on this page. The next page may have more."
            : "No reality shows matched these filters on this page.",
          morePages ? "Check next page" : "Clear filters",
          morePages ? () => changePage(1) : clearFilters
        );
      } else {
        grid.replaceChildren(...shows.map(createCard));
        count.textContent =
          `${shows.length} reality ${shows.length === 1 ? "show" : "shows"} on this page`;

        if (!reducedMotion && window.gsap) {
          window.gsap.from(grid.querySelectorAll(".show-card"), {
            opacity: 0,
            y: 20,
            duration: 0.45,
            stagger: 0.05,
            ease: "power2.out"
          });
        }
      }

      updatePagination();
    } catch (error) {
      if (thisRequest !== requestNumber) return;

      console.error("Discover could not load:", error);
      count.textContent = "Could not load shows.";
      showMessage("The reality shows could not load right now.", "Try again", loadShows);
    } finally {
      if (thisRequest === requestNumber) {
        grid.setAttribute("aria-busy", "false");
      }
    }
  }

  function changePage(direction) {
    const requestedPage = page + direction;
    if (requestedPage < 1 || requestedPage > totalPages) return;

    page = requestedPage;
    loadShows();
    heading.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start"
    });
  }

  
  /* Discover controls */

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    filters.search = search.value.trim();
    filters.category = "";
    page = 1;
    loadShows();
  });

  for (const [name, control] of Object.entries(controls)) {
    control.addEventListener("change", function () {
      filters[name] = control.value;
      page = 1;
      loadShows();
    });
  }

  clearButton.addEventListener("click", clearFilters);
  previous.addEventListener("click", () => changePage(-1));
  next.addEventListener("click", () => changePage(1));

  if (!reducedMotion && window.gsap) {
    window.gsap.from(".discover-heading > *", {
      opacity: 0,
      y: 24,
      duration: 0.65,
      stagger: 0.12,
      ease: "power2.out"
    });
  }

  readUrl();
  loadShows();
});