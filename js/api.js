/* TMDB authentication */

const TMDB_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjNWM5ZmRlODdiZmI2ZGFkOWRhYTkyYjM3ZWNjMWQ0OSIsIm5iZiI6MTc4OTQzMzM1Mi41NzcsInN1YiI6IjZhYTg5NjA4ZTNiNzk5YjE5MjNlMGZkMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.hlDzwhK38rCHTtthBB3jPtHaDSgfug4UgEXzH9CWOx4";


const TMDB_BASE_URL =
  "https://api.themoviedb.org/3";

const TMDB_IMAGE_URL =
  "https://image.tmdb.org/t/p";

/* General API request */

async function tmdbRequest(endpoint, parameters = {}) {
  if (!TMDB_ACCESS_TOKEN) {
    throw new Error(
      "The TMDB Read Access Token has not been added."
    );
  }

  const requestUrl = new URL(
    `${TMDB_BASE_URL}${endpoint}`
  );

  requestUrl.searchParams.set("language", "en-US");

  Object.entries(parameters).forEach(function ([key, value]) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      requestUrl.searchParams.set(key, value);
    }
  });

  const response = await fetch(requestUrl, {
    method: "GET",

    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    let errorMessage =
      `TMDB request failed with status ${response.status}.`;

    try {
      const errorData = await response.json();

      if (errorData.status_message) {
        errorMessage = errorData.status_message;
      }
    } catch (error) {
      console.error("Could not read the TMDB error.", error);
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/* Image links */

function getPosterUrl(posterPath, size = "w500") {
  if (!posterPath) {
    return "";
  }

  return `${TMDB_IMAGE_URL}/${size}${posterPath}`;
}

function getBackdropUrl(
  backdropPath,
  size = "w1280"
) {
  if (!backdropPath) {
    return "";
  }

  return `${TMDB_IMAGE_URL}/${size}${backdropPath}`;
}

/* Search for one TV show */

async function searchTvShow(showName) {
  const data = await tmdbRequest("/search/tv", {
    query: showName,
    include_adult: false,
    page: 1
  });

  if (!data.results || data.results.length === 0) {
    return null;
  }

  const lowerCaseName = showName.toLowerCase();

  const exactMatch = data.results.find(function (show) {
    const translatedName = (
      show.name || ""
    ).toLowerCase();

    const originalName = (
      show.original_name || ""
    ).toLowerCase();

    return (
      translatedName === lowerCaseName ||
      originalName === lowerCaseName
    );
  });

  return exactMatch || data.results[0];
}

/* Search for several shows */

async function getShowsByNames(showNames) {
  const requests = showNames.map(function (showName) {
    return searchTvShow(showName);
  });

  const results = await Promise.all(requests);

  return results.filter(function (show) {
    return show !== null;
  });
}

/* Load trending reality shows */

async function getTrendingRealityShows(limit = 4) {
  const trendingData = await tmdbRequest(
    "/trending/tv/week",
    {
      page: 1
    }
  );

  let realityShows = trendingData.results.filter(
    function (show) {
      return (
        show.genre_ids?.includes(10764) &&
        show.poster_path
      );
    }
  );

  if (realityShows.length < limit) {
    const discoveryData = await tmdbRequest(
      "/discover/tv",
      {
        with_genres: 10764,
        sort_by: "popularity.desc",
        include_adult: false,
        page: 1
      }
    );

    realityShows = [
      ...realityShows,
      ...discoveryData.results
    ];
  }

  const uniqueShows = realityShows.filter(function (
    show,
    index,
    shows
  ) {
    return (
      shows.findIndex(function (item) {
        return item.id === show.id;
      }) === index
    );
  });

  return uniqueShows.slice(0, limit);
}
/* Discover TV shows using filters */

async function discoverTvShows(options = {}) {
  const secondaryGenre = options.genre || "";
  const sortBy = options.sortBy || "popularity.desc";
  const page = options.page || 1;

  const requiredGenres = secondaryGenre
    ? `10764,${secondaryGenre}`
    : "10764";

  const parameters = {
    with_genres: requiredGenres,
    sort_by: sortBy,
    include_adult: false,
    page: page
  };

  if (sortBy === "vote_average.desc") {
    parameters["vote_count.gte"] = 50;
  }

  return tmdbRequest("/discover/tv", parameters);
}

/* Search for TV shows using text */

async function searchTvShows(searchTerm, page = 1) {
  return tmdbRequest("/search/tv", {
    query: searchTerm,
    include_adult: false,
    page: page
  });
}
/* Load the featured show */

async function getFeaturedShow() {
  return searchTvShow(
    "The Real Housewives of Atlanta"
  );
}

async function getShowDetails(showId) {
  return tmdbRequest(`/tv/${showId}`);
}

/*
 * Get all the episodes from one season.
 */
async function getShowSeason(showId, seasonNumber) {
  return tmdbRequest(`/tv/${showId}/season/${seasonNumber}`);
}

/*
 * Get shows recommended by TMDB as similar.
 */
async function getSimilarShows(showId, page = 1) {
  return tmdbRequest(`/tv/${showId}/similar`, {
    page: page
  });
}
/*
 * Get information for one specific episode.
 */
async function getEpisodeDetails(
  showId,
  seasonNumber,
  episodeNumber
) {
  return tmdbRequest(
    `/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`
  );
}

/*
 * Get the streaming providers for a TV show.
 * The Episode Details page will use the South African results.
 */
async function getWatchProviders(showId) {
  return tmdbRequest(`/tv/${showId}/watch/providers`);
}

/*
 * Create the full TMDB URL for an episode still image.
 */
function getStillUrl(stillPath, size = "w780") {
  if (!stillPath) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${stillPath}`;
}

/*
 * Create the full TMDB URL for a streaming provider logo.
 */
function getProviderLogoUrl(logoPath, size = "w92") {
  if (!logoPath) {
    return null;
  }

  return `https://image.tmdb.org/t/p/${size}${logoPath}`;
}
window.tmdbApi = {
  getPosterUrl,
  getBackdropUrl,
  searchTvShow,
  getShowsByNames,
  getTrendingRealityShows,
  getFeaturedShow,
  discoverTvShows,
  searchTvShows,
  getShowDetails,
  getShowSeason,
  getSimilarShows,
  getEpisodeDetails,
  getWatchProviders,
  getStillUrl,
  getProviderLogoUrl
};