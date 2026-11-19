document.addEventListener("DOMContentLoaded", function () {
  /* Episode setup */

  const find = selector => document.querySelector(selector);
  const api = window.tmdbApi;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const params = new URLSearchParams(window.location.search);
  const showId = params.get("showId");
  const season = params.get("season");
  const episodeNumber = params.get("episode");
  const reactionKey = `groupChatReactions-${showId}-${season}-${episodeNumber}`;
  const savedShowsKey = "groupChatSavedShows";

  const loading = find("#episode-details-loading");
  const errorBox = find("#episode-details-error");
  const retryEpisode = find("#retry-episode-details");
  const content = find("#episode-details-content");
  const backLink = find("#episode-back-link");
  const saveButton = find("#episode-save-show");

  const providerGrid = find("#watch-provider-grid");
  const providerStatus = find("#watch-provider-status");
  const retryProviders = find("#retry-watch-providers");

  const cover = find("#group-chat-cover");
  const chat = find("#group-chat-content");
  const chatHeading = find("#group-chat-heading");
  const reactionGrid = find("#reaction-grid");
  const writeButton = find("#write-review-button");
  const dialog = find("#review-dialog");
  const form = find("#review-form");
  const formError = find("#review-form-error");
  const confirmation = find("#review-confirmation");

  let currentShow = null;
  let confirmationTimer;

  const exampleReactions = [
    {
      name: "Lerato", mood: "Shocked", time: "12 min ago",
      comment: "The silence after that comment told me everything I needed to know."
    },
    {
      name: "Mia", mood: "Absolutely not", time: "18 min ago",
      comment: "Not them acting shocked when they started the entire situation."
    },
    {
      name: "Zee", mood: "Team them", time: "25 min ago",
      comment: "I am sorry but she had a point. Someone needed to say it."
    },
    {
      name: "Nandi", mood: "Shocked", time: "31 min ago",
      comment: "This dinner went left so quickly and I enjoyed every second."
    },
    {
      name: "Kat", mood: "Absolutely not", time: "40 min ago",
      comment: "The apology somehow made everything worse. Impressive."
    },
    {
      name: "Amahle", mood: "Team them", time: "48 min ago",
      comment: "She came with screenshots. The argument was over immediately."
    }
  ];

  function readList(key) {
    try {
      const items = JSON.parse(localStorage.getItem(key));
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  /* Save Show bookmark */

  function matchesShow(entry) {
    return typeof entry === "string"
      ? entry === currentShow.name
      : entry?.name === currentShow.name ||
        String(entry?.id) === String(currentShow.id);
  }

  function updateBookmark() {
    if (!currentShow) return;

    const saved = readList(savedShowsKey).some(matchesShow);
    saveButton.classList.toggle("saved", saved);
    saveButton.setAttribute("aria-pressed", String(saved));
    saveButton.setAttribute(
      "aria-label",
      saved ? `Remove ${currentShow.name} from My List` : `Save ${currentShow.name} to My List`
    );
    saveButton.innerHTML = bookmarkIcon(saved) +
      `<span>${saved ? "Saved" : "Save Show"}</span>`;
  }

  saveButton.addEventListener("click", function () {
    if (!currentShow) return;

    const list = readList(savedShowsKey);
    const saved = list.some(matchesShow);
    const updated = saved
      ? list.filter(entry => !matchesShow(entry))
      : [...list, currentShow.name];

    try {
      localStorage.setItem(savedShowsKey, JSON.stringify(updated));
      updateBookmark();
      find("#episode-save-status").textContent =
        saved ? "Removed from My List." : "Saved to My List.";
    } catch {
      find("#episode-save-status").textContent = "Could not update My List in this browser.";
    }
  });

  /* Where to Watch */

  function makeProviderCard(provider, watchUrl) {
    const card = document.createElement(watchUrl ? "a" : "div");
    const name = provider.provider_name || "Streaming provider";
    card.className = "watch-provider-card";

    if (watchUrl) {
      card.href = watchUrl;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }

    const logoBox = document.createElement("span");
    logoBox.className = "provider-logo-box";
    const logoUrl = api.getProviderLogoUrl(provider.logo_path);

    if (logoUrl) {
      const image = document.createElement("img");
      image.src = logoUrl;
      image.alt = name;
      image.loading = "lazy";
      logoBox.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "provider-logo-placeholder";
      placeholder.textContent = name;
      logoBox.append(placeholder);
    }

    card.append(logoBox);

    if (watchUrl) {
      const linkLabel = document.createElement("span");
      linkLabel.className = "provider-watch-button";
      linkLabel.textContent = "Watch options ↗";
      card.setAttribute(
        "aria-label",
        `See where to watch, including ${name}, on TMDB (opens in a new tab)`
      );
      card.append(linkLabel);
    }

    return card;
  }

  async function loadWatchProviders() {
    providerGrid.replaceChildren();
    providerStatus.textContent = "Checking South African streaming availability…";
    retryProviders.hidden = true;

    try {
      const response = await api.getWatchProviders(showId);
      const regions = response?.results || {};
      const providerTypes = ["flatrate", "free", "ads", "buy", "rent"];
      const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

      const preferredCountries = ["ZA", "US", "GB", "AU", "CA"];
      const countryCodes = [...new Set([...preferredCountries, ...Object.keys(regions)])];

      const countryCode = countryCodes.find(code =>
      providerTypes.some(type => regions[code]?.[type]?.length > 0)
      );

const region = countryCode ? regions[countryCode] : null;
      const providers = new Map();

      for (const category of ["flatrate", "free", "ads", "buy", "rent"]) {
        for (const provider of region?.[category] || []) {
          providers.set(provider.provider_id, provider);
        }
      }

      if (!providers.size) {
        providerStatus.textContent =
        "TMDB doesn’t list any watch options for this show right now.";
      }

      const watchUrl = /^https:\/\/(?:www\.)?themoviedb\.org\//i.test(region?.link || "")
        ? region.link
        : "";

      const country = countryNames.of(countryCode);

     providerStatus.textContent = countryCode === "ZA"
       ? "Watch options for South Africa."
       : `No South African listings on TMDB. Watch options for ${country}.`;
      providerGrid.replaceChildren(
        ...Array.from(providers.values(), provider => makeProviderCard(provider, watchUrl))
      );
    } catch (error) {
      console.error("Watch providers:", error);
      providerStatus.textContent = "Streaming information could not load right now.";
      retryProviders.hidden = false;
    }
  }

  retryProviders.addEventListener("click", loadWatchProviders);

  /* Reactions and deletion */

  function announce(message) {
    clearTimeout(confirmationTimer);
    confirmation.hidden = false;
    confirmation.textContent = message;
    confirmationTimer = setTimeout(() => {
      confirmation.hidden = true;
    }, 3500);
  }

  function makeReactionCard(reaction, savedIndex = -1) {
    const card = document.createElement("article");
    card.className = savedIndex >= 0 ? "reaction-card new-reaction" : "reaction-card";
    card.innerHTML = `
      <div class="reaction-card-top">
        <span class="reaction-avatar" aria-hidden="true"></span>
        <div><h3></h3><p></p></div>
        <span class="reaction-mood"></span>
      </div>
      <p class="reaction-comment"></p>
      <span class="reaction-card-quotes" aria-hidden="true">” ”</span>
    `;

    const name = reaction.name || "Viewer";
    card.querySelector(".reaction-avatar").textContent = name.charAt(0).toUpperCase();
    card.querySelector("h3").textContent = name;
    card.querySelector(".reaction-card-top p").textContent =
      savedIndex >= 0 ? "Your reaction" : reaction.time;
    card.querySelector(".reaction-mood").textContent = reaction.mood;
    card.querySelector(".reaction-comment").textContent = `“${reaction.comment}”`;
    const actions = document.createElement("div");
actions.className = "reaction-actions";
card.append(actions);

const likeButton = document.createElement("button");
likeButton.type = "button";
likeButton.className = "reaction-like-button";

const likesKey = `${reactionKey}-likes`;
const likeId = JSON.stringify([
  savedIndex >= 0 ? "my-reaction" : "example",
  reaction.id || [reaction.name, reaction.comment, reaction.mood]
]);

function updateLikeButton(liked) {
  likeButton.setAttribute("aria-pressed", String(liked));
  likeButton.setAttribute("aria-label", `Like ${name}’s reaction`);
  likeButton.textContent = `${liked ? "♥" : "♡"} ${liked ? 1 : 0}`;
}

updateLikeButton(readList(likesKey).includes(likeId));

likeButton.addEventListener("click", function () {
  const likes = readList(likesKey);
  const liked = likes.includes(likeId);
  const updated = liked
    ? likes.filter(id => id !== likeId)
    : [...likes, likeId];

  try {
    localStorage.setItem(likesKey, JSON.stringify(updated));
    updateLikeButton(!liked);
  } catch {
    announce("Your like could not be saved in this browser.");
  }
});

actions.append(likeButton);

    if (savedIndex >= 0) {
      const remove = document.createElement("button");
      remove.className = "delete-review-button";
      remove.type = "button";
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", "Delete my reaction");

      remove.addEventListener("click", function () {
        if (!window.confirm("Delete this reaction?")) return;

        const saved = readList(reactionKey);
        const index = reaction.id
          ? saved.findIndex(item => item?.id === reaction.id)
          : saved.findIndex(item =>
              item?.name === reaction.name &&
              item?.comment === reaction.comment &&
              item?.mood === reaction.mood
            );

        if (index < 0) {
          renderReactions();
          writeButton.focus();
          return;
        }

        saved.splice(index, 1);

        try {
          localStorage.setItem(reactionKey, JSON.stringify(saved));
          renderReactions();
          writeButton.focus();
          announce("Your reaction was deleted.");
        } catch {
          announce("Your reaction could not be deleted in this browser.");
        }
      });

      actions.append(remove);
    }

    return card;
  }

  function renderReactions() {
    const savedCards = readList(reactionKey).filter(Boolean).map(makeReactionCard);
    const exampleCards = exampleReactions.map(reaction => makeReactionCard(reaction));
    reactionGrid.replaceChildren(...savedCards, ...exampleCards);
  }

  cover.addEventListener("click", function () {
    cover.setAttribute("aria-expanded", "true");
    renderReactions();
    chat.hidden = false;
    cover.hidden = true;
    chatHeading.focus({ preventScroll: true });

    if (!reducedMotion && gsap) {
      gsap.timeline()
        .from(chat, { opacity: 0, y: 18, duration: 0.35 })
        .from(".reaction-card", {
          opacity: 0, y: 12, duration: 0.3, stagger: 0.06
        }, "-=0.12");
    }
  });

  /* Reaction form */

  writeButton.addEventListener("click", function () {
  function openReview() {
    formError.hidden = true;
    dialog.showModal();
    find("#review-comment").focus();
  }

  if (window.getGroupChatUsername()) {
    openReview();
  } else {
    window.openGroupChatProfile(openReview);
  }
});

  find("#close-review-button").addEventListener("click", () => dialog.close());
  /* Dismiss the review form */

let returnToChatCover = false;

dialog.addEventListener("click", function (event) {
  if (event.target !== dialog) return;

  const box = dialog.getBoundingClientRect();
  const clickedOutside =
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom;

  if (clickedOutside) {
    returnToChatCover = true;
    dialog.close();
  }
});

dialog.addEventListener("cancel", function () {
  returnToChatCover = true;
});

dialog.addEventListener("close", function () {
  if (returnToChatCover) {
    chat.hidden = true;
    cover.hidden = false;
    cover.setAttribute("aria-expanded", "false");
    returnToChatCover = false;
    cover.focus();
  } else {
    writeButton.focus();
  }
});

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const fields = new FormData(form);
    const name = window.getGroupChatUsername();
    const comment = String(fields.get("comment") || "").trim();
    const mood = String(fields.get("mood") || "");

    if (!name || !comment || !mood) {
      formError.textContent = "Please set a username, write a reaction and pick a mood.";
      formError.hidden = false;
      find("#review-comment").focus();
      return;
    }

    const reaction = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name,
      comment,
      mood,
      time: "Just now"
    };

    try {
      const saved = readList(reactionKey);
      localStorage.setItem(reactionKey, JSON.stringify([reaction, ...saved]));
      renderReactions();
      form.reset();
      dialog.close();
      announce("Your reaction joined the Group Chat.");
    } catch {
      formError.textContent = "Your reaction could not be saved in this browser.";
      formError.hidden = false;
    }
  });

  /* Load episode details */

  function showError(message, canRetry) {
    loading.hidden = true;
    content.hidden = true;
    errorBox.hidden = false;
    retryEpisode.hidden = !canRetry;
    find("#episode-error-message").textContent = message;
  }

  async function loadEpisode() {
    const validNumber = value => /^\d+$/.test(value || "");
    if (![showId, season, episodeNumber].every(validNumber)) {
      showError("Open a show and choose an episode to see its details.", false);
      return;
    }

    backLink.href = `show-details.html?${new URLSearchParams({ id: showId, season })}`;
    backLink.textContent = "← Back to Show";
    loading.hidden = false;
    errorBox.hidden = true;

    try {
      const [show, episode] = await Promise.all([
        api.getShowDetails(showId),
        api.getEpisodeDetails(showId, season, episodeNumber)
      ]);

      if (!show?.name || !episode) throw new Error("Episode data is missing.");

      currentShow = show;
      document.title = `${episode.name || `Episode ${episodeNumber}`} | The Group Chat`;
      find("#episode-show-name").textContent = show.name;
      find("#episode-title").textContent = episode.name || "Title unavailable";
      find("#episode-number").textContent = `Season ${season} · Episode ${episodeNumber}`;
      find("#episode-duration").textContent =
        Number(episode.runtime) > 0 ? `${episode.runtime} minutes` : "Not listed";
      find("#episode-overview").textContent =
        episode.overview || "No episode description is available yet.";
      find("#chat-episode-label").textContent =
        `Episode ${episodeNumber.padStart(2, "0")}`;

      const imageBox = find("#episode-still-container");
      const stillUrl = episode.still_path
        ? api.getStillUrl(episode.still_path)
        : show.backdrop_path
          ? api.getBackdropUrl(show.backdrop_path)
          : "";

      if (stillUrl) {
        const image = document.createElement("img");
        image.src = stillUrl;
        image.alt = episode.still_path
          ? `Still from ${episode.name || `episode ${episodeNumber}`}`
          : `Promotional image for ${show.name}`;
        imageBox.replaceChildren(image);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "episode-missing-still";
        placeholder.textContent = "Episode image unavailable";
        imageBox.replaceChildren(placeholder);
      }

      updateBookmark();
      loading.hidden = true;
      content.hidden = false;
      loadWatchProviders();

      if (!reducedMotion && gsap) {
        gsap.from(".episode-details-hero > div", {
          opacity: 0, y: 20, duration: 0.55, stagger: 0.12, ease: "power2.out"
        });

        if (ScrollTrigger) {
          gsap.registerPlugin(ScrollTrigger);
          gsap.from(".where-to-watch-section", {
            scrollTrigger: {
              trigger: ".where-to-watch-section",
              start: "top 90%",
              once: true
            },
            opacity: 0,
            y: 20,
            duration: 0.5
          });
        }
      }
    } catch (error) {
      console.error("Episode details:", error);
      showError("This episode could not load right now.", true);
    }
  }

  retryEpisode.addEventListener("click", loadEpisode);
  loadEpisode();
});