/* Shared bookmark icon */

function bookmarkIcon(isSaved = false) {
  return `
    <svg class="bookmark-icon" viewBox="0 0 24 28" aria-hidden="true">
      <path
        d="M3 2.5h18v23l-9-6-9 6z"
        fill="${isSaved ? "currentColor" : "none"}"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

document.addEventListener("DOMContentLoaded", function () {
  /* Shared mobile navigation */

  const menuButton = document.querySelector("#menu-button, #mobile-menu-button");
  const mobileNav = document.querySelector("#mobile-navigation");

  if (menuButton && mobileNav) {
    function setMenu(open) {
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute(
        "aria-label",
        open ? "Close navigation menu" : "Open navigation menu"
      );
      menuButton.classList.toggle("open", open);
      menuButton.classList.toggle("is-open", open);
      mobileNav.hidden = !open;

      if (menuButton.id === "menu-button") {
        menuButton.textContent = open ? "×" : "☰";
      }
    }

    menuButton.addEventListener("click", function () {
      setMenu(menuButton.getAttribute("aria-expanded") !== "true");
    });

    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", () => setMenu(false));
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !mobileNav.hidden) {
        setMenu(false);
        menuButton.focus();
      }
    });
  }
  
  /* Shared profile */

const profileKey = "groupChatProfile";

window.getGroupChatUsername = function () {
  try {
    return JSON.parse(localStorage.getItem(profileKey) || "{}").username || "";
  } catch {
    return "";
  }
};

const profileMark = document.querySelector(".profile-mark");

if (profileMark) {
  const profileButton = document.createElement("button");
  profileButton.type = "button";
  profileButton.className = "profile-mark";
  profileButton.setAttribute("aria-label", "Edit your profile");
  profileButton.setAttribute("aria-haspopup", "dialog");
  profileButton.innerHTML = '<span aria-hidden="true"></span>';
  profileMark.replaceWith(profileButton);

  const profileDialog = document.createElement("dialog");
  profileDialog.className = "review-dialog";
  profileDialog.setAttribute("aria-labelledby", "profile-heading");
  profileDialog.innerHTML = `
    <div class="review-dialog-topbar">
      <p id="profile-heading">Your profile</p>
      <button type="button" class="close-review-button" aria-label="Close profile">×</button>
    </div>
    <form class="review-form">
      <label for="profile-username">Username</label>
      <input id="profile-username" maxlength="30" autocomplete="nickname" required />

      <label for="profile-email">Email (optional)</label>
      <input id="profile-email" type="email" autocomplete="email" />
      <p>Only your username is saved in this browser. Your email isn’t saved.</p>

      <p class="profile-message" role="alert" hidden></p>
      <button class="send-review-button" type="submit">Save profile</button>
    </form>
  `;
  document.body.append(profileDialog);

  const profileForm = profileDialog.querySelector("form");
  const username = profileDialog.querySelector("#profile-username");
  const message = profileDialog.querySelector(".profile-message");
  let afterSave = null;

  window.openGroupChatProfile = function (onSave) {
    afterSave = onSave || null;
    username.value = window.getGroupChatUsername();
    message.hidden = true;
    profileDialog.showModal();
    username.focus();
  };

  profileButton.addEventListener("click", () => window.openGroupChatProfile());
  profileDialog.querySelector(".close-review-button")
    .addEventListener("click", () => profileDialog.close());

  profileForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const name = username.value.trim();

    if (!name) {
      message.textContent = "Please enter a username.";
      message.hidden = false;
      username.focus();
      return;
    }

    try {
      localStorage.setItem(profileKey, JSON.stringify({ username: name }));
    } catch {
      message.textContent = "This browser couldn’t save your username.";
      message.hidden = false;
      return;
    }

    const continueAfterSave = afterSave;
    afterSave = null;
    profileDialog.close();
    if (continueAfterSave) continueAfterSave();
  });

  profileDialog.addEventListener("close", function () {
    profileDialog.querySelector("#profile-email").value = "";
  });
}
  /* Home page setup */

  const hero = document.querySelector(".mood-hero");
  if (!hero) return;

  const api = window.tmdbApi;
  const gsap = window.gsap;
  const scrollTrigger = window.ScrollTrigger;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const storageKey = "groupChatSavedShows";

  const moodButtons = [...hero.querySelectorAll(".mood-chip")];
  const moodSelect = document.querySelector("#mood-select");
  const moodResults = document.querySelector("#mood-results");
  const moodHeading = document.querySelector("#results-heading");
  const moodGrid = document.querySelector("#mood-results-grid");
  const moodStatus = document.querySelector("#mood-feedback");
  const trendingGrid = document.querySelector(".trending-grid");
  const trendingStatus = document.querySelector("#trending-status");

  const featuredTitle = document.querySelector("#featured-title");
  const featuredPoster = document.querySelector(".featured-image");
  const featuredLink = document.querySelector(".featured-copy a.small-button");
  const featuredSave = document.querySelector(".save-featured");

  const moods = {
    dramatic: {
      label: "Messy Drama",
      shows: [
        "The Secret Lives of Mormon Wives",
        "The Real Housewives of Atlanta",
        "Vanderpump Villa",
        "The Traitors"
      ]
    },
    romantic: {
      label: "Romantic",
      shows: ["The Bachelorette", "Love Island", "Love Is Blind", "Perfect Match"]
    },
    funny: {
      label: "Funny",
      shows: ["The Circle", "Love on the Spectrum", "Queer Eye", "RuPaul's Drag Race"]
    },
    chaotic: {
      label: "Demotivated",
      shows: ["Queer Eye", "The Great British Bake Off", "Making the Cut", "Next in Fashion"]
    },
    competitive: {
      label: "Fabulous",
      shows: ["The Real Housewives of Beverly Hills", "Dubai Bling", "Selling Sunset", "The Kardashians"]
    }
  };

  let moodRequest = 0;

  /* Saved shows */

  function readSavedShows() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function savedName(entry) {
    return typeof entry === "string" ? entry : entry?.name;
  }

  function updateBookmarks() {
    const savedShows = readSavedShows();

    document.querySelectorAll("button[data-save-show]").forEach(function (button) {
      const name = button.dataset.saveShow;
      const saved = savedShows.some(entry => savedName(entry) === name);
      const withLabel = button.classList.contains("save-featured");

      button.classList.toggle("saved", saved);
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute(
        "aria-label",
        saved ? `Remove ${name} from My List` : `Save ${name} to My List`
      );
      button.innerHTML = bookmarkIcon(saved) +
        (withLabel ? `<span>${saved ? "Saved" : "Save show"}</span>` : "");
    });
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-save-show]");
    if (!button) return;

    const name = button.dataset.saveShow;
    const saved = readSavedShows();
    const alreadySaved = saved.some(entry => savedName(entry) === name);
    const updated = alreadySaved
      ? saved.filter(entry => savedName(entry) !== name)
      : [...saved, name];

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      updateBookmarks();

      if (!reducedMotion && gsap) {
        gsap.fromTo(button, { scale: 0.82 }, { scale: 1, duration: 0.25 });
      }
    } catch {
      moodStatus.textContent = "This browser could not update your saved shows.";
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === null) updateBookmarks();
  });

  /* Home show cards */

  function getShowName(show) {
    return show.name || show.original_name || "Untitled reality show";
  }

  function showUrl(show) {
    return `show-details.html?id=${encodeURIComponent(show.id)}`;
  }

  function renderCard(show, compact) {
    const card = document.createElement("article");
    card.className = "show-card";

    const name = getShowName(show);
    const link = document.createElement("a");
    link.href = showUrl(show);

    const poster = document.createElement("div");
    poster.className = "show-card-image";
    const url = api.getPosterUrl(show.poster_path);

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.loading = "lazy";
      poster.append(image);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "poster-fallback";
      fallback.textContent = "Poster unavailable";
      poster.append(fallback);
    }

    const content = document.createElement("div");
    content.className = "show-card-content";
    const title = document.createElement("h3");
    title.textContent = name;

    const tags = document.createElement("p");
    const year = (show.first_air_date || "").slice(0, 4);
    const score = Number(show.vote_average);
    tags.textContent = [
      "Reality TV",
      year,
      !compact && score > 0 ? `${Math.round(score * 10)}% user score` : ""
    ].filter(Boolean).join(" · ");

    content.append(title, tags);
    link.append(poster, content);
    card.append(link);

    if (!compact) {
      const view = document.createElement("span");
      view.className = "card-button";
      view.textContent = "View show →";
      content.append(view);

      const save = document.createElement("button");
      save.className = "save-button";
      save.type = "button";
      save.dataset.saveShow = name;
      card.append(save);
    }

    return card;
  }

  function renderShows(grid, shows, compact = false) {
    grid.replaceChildren(...shows.map(show => renderCard(show, compact)));
    grid.setAttribute("aria-busy", "false");
    updateBookmarks();

    if (!reducedMotion && gsap) {
      gsap.from(grid.querySelectorAll(".show-card"), {
        opacity: 0,
        y: 20,
        duration: 0.45,
        stagger: 0.07,
        ease: "power2.out"
      });
      if (scrollTrigger) scrollTrigger.refresh();
    }
  }

  /* Loading, empty and error states */

  function showLoading(grid) {
    grid.setAttribute("aria-busy", "true");
    grid.innerHTML = Array.from({ length: 4 }, () => `
      <article class="show-card loading-card" aria-hidden="true">
        <div class="show-card-image loading-image"></div>
        <div class="show-card-content">
          <div class="loading-line loading-title"></div>
          <div class="loading-line loading-text"></div>
        </div>
      </article>
    `).join("");
  }

  function showMessage(grid, message, retry) {
    const box = document.createElement("div");
    box.className = `api-state ${retry ? "error-state" : "empty-state"}`;
    const text = document.createElement("p");
    text.textContent = message;
    box.append(text);

    if (retry) {
      const button = document.createElement("button");
      button.className = "retry-button";
      button.type = "button";
      button.textContent = "Try again";
      button.addEventListener("click", retry);
      box.append(button);
    }

    grid.replaceChildren(box);
    grid.setAttribute("aria-busy", "false");
  }

  /* Mood selection */

  async function selectMood(key) {
    const request = ++moodRequest;
    const mood = moods[key];
    moodSelect.value = mood ? key : "";

    moodButtons.forEach(function (button) {
      const selected = button.dataset.mood === key;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (!mood) {
      moodResults.hidden = true;
      moodStatus.textContent = "";
      moodGrid.setAttribute("aria-busy", "false");
      return;
    }

    moodHeading.textContent = `For your ${mood.label} mood`;
    moodResults.hidden = false;
    moodStatus.textContent = "Finding shows for your mood…";
    showLoading(moodGrid);

    try {
      const shows = await api.getShowsByNames(mood.shows);
      if (request !== moodRequest) return;

      if (shows.length) {
        renderShows(moodGrid, shows, true);
        moodStatus.textContent =
          `${shows.length} ${shows.length === 1 ? "recommendation" : "recommendations"} found.`;
      } else {
        showMessage(moodGrid, "No shows matched this mood. Try another mood.");
        moodStatus.textContent = "";
      }
    } catch (error) {
      if (request !== moodRequest) return;
      console.error("Mood recommendations:", error);
      showMessage(
        moodGrid,
        "The mood recommendations could not load right now.",
        () => selectMood(key)
      );
      moodStatus.textContent = "";
    }
  }

  moodButtons.forEach(function (button) {
    button.addEventListener("click", () => selectMood(button.dataset.mood));
  });

  moodSelect.addEventListener("change", () => selectMood(moodSelect.value));

  /* Featured show */

  featuredSave.dataset.saveShow = "The Real Housewives of Atlanta";
  updateBookmarks();

  async function loadFeaturedShow() {
    featuredPoster.setAttribute("aria-busy", "true");

    try {
      const show = await api.getFeaturedShow();

      if (!show) {
        featuredPoster.textContent = "No featured show is available right now.";
        return;
      }

      const name = getShowName(show);
      const posterUrl = api.getPosterUrl(show.poster_path) ||
        (show.backdrop_path ? api.getBackdropUrl(show.backdrop_path) : "");

      if (name !== "The Real Housewives of Atlanta") {
        featuredTitle.textContent = name;
      }

      featuredLink.href = showUrl(show);
      featuredPoster.href = showUrl(show);
      featuredPoster.setAttribute("aria-label", `View ${name}`);
      featuredSave.dataset.saveShow = name;

      if (posterUrl) {
        const image = document.createElement("img");
        image.src = posterUrl;
        image.alt = `${name} poster`;
        featuredPoster.replaceChildren(image);
        featuredPoster.classList.add("has-image");
      } else {
        featuredPoster.textContent = "Featured poster unavailable.";
      }

      updateBookmarks();
    } catch (error) {
      console.error("Featured show:", error);
      featuredPoster.textContent = "The featured poster could not load right now.";
    } finally {
      featuredPoster.setAttribute("aria-busy", "false");
    }
  }

  /* Trending shows */

  async function loadTrending() {
    trendingStatus.textContent = "Loading trending shows…";
    showLoading(trendingGrid);

    try {
      const shows = await api.getTrendingRealityShows(4);

      if (shows.length) {
        renderShows(trendingGrid, shows);
        trendingStatus.textContent = "Trending shows loaded.";
      } else {
        showMessage(trendingGrid, "No trending reality shows were found.");
        trendingStatus.textContent = "No trending shows found.";
      }
    } catch (error) {
      console.error("Trending shows:", error);
      showMessage(trendingGrid, "Trending shows could not load right now.", loadTrending);
      trendingStatus.textContent = "Trending shows could not load.";
    }
  }

  /* Home animation */

  if (!reducedMotion && gsap) {
    const intro = gsap.timeline({ defaults: { ease: "power2.out" } });

    intro
      .from(".mood-heading h1", { opacity: 0, y: 28, duration: 0.65 })
      .from(".hero-description", { opacity: 0, y: 16, duration: 0.4 }, "-=0.25")
      .from(".mood-chip, .mobile-mood", {
        opacity: 0,
        y: 12,
        duration: 0.4,
        stagger: 0.06
      }, "-=0.2");

    gsap.to(".mood-decoration", {
      rotation: 360,
      duration: 36,
      repeat: -1,
      ease: "none"
    });

    if (scrollTrigger) {
      gsap.registerPlugin(scrollTrigger);

      document.querySelectorAll(".reveal-section").forEach(function (section) {
        gsap.from(section, {
          scrollTrigger: { trigger: section, start: "top 90%", once: true },
          opacity: 0,
          y: 24,
          duration: 0.55,
          ease: "power2.out"
        });
      });
    }
  }

  loadFeaturedShow();
  loadTrending();
});