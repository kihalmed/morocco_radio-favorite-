(() => {
  "use strict";

  const API_SERVERS = [
    "https://de1.api.radio-browser.info",
    "https://nl1.api.radio-browser.info",
    "https://at1.api.radio-browser.info"
  ];
  const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
  const STORAGE = {
    favorites: "radioMaroc.favorites.v1",
    recent: "radioMaroc.recent.v1",
    theme: "radioMaroc.theme.v1"
  };

  const $ = (selector) => document.querySelector(selector);
  const audio = $("#audio");
  const grid = $("#station-grid");
  const status = $("#directory-status");
  const playerStatus = $("#player-status");
  const searchInput = $("#search");
  const languageFilter = $("#language-filter");
  const categoryFilter = $("#category-filter");
  const playToggle = $("#play-toggle");

  let stations = [];
  let activeStation = null;
  let currentView = "all";
  let apiBase = API_SERVERS[0];
  let refreshTimer = null;
  let requestInProgress = false;

  const safeRead = (key, fallback) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
  };
  const favorites = () => safeRead(STORAGE.favorites, []);
  const recent = () => safeRead(STORAGE.recent, []);
  const stationId = (station) => station.stationuuid || station.url_resolved || station.url || station.name;

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function applyTheme(theme) {
    const chosen = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = chosen;
    $("#theme-toggle").textContent = chosen === "dark" ? "☀" : "☾";
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${chosen === "dark" ? "light" : "dark"} theme`);
    try { localStorage.setItem(STORAGE.theme, chosen); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = chosen === "dark" ? "#111319" : "#f7f8fa";
  }

  function normalizedTags(station) {
    return `${station.tags || ""} ${station.name || ""} ${station.language || ""}`.toLowerCase();
  }

  function matchesCategory(station, category) {
    if (!category) return true;
    const value = normalizedTags(station);
    const groups = {
      music: ["music", "pop", "rock", "jazz", "dance", "hits", "rap", "classical", "chaabi", "rai"],
      news: ["news", "talk", "information", "actualité", "actualite", "journal", "politic"],
      sports: ["sport", "football", "sports"],
      religious: ["religious", "religion", "islam", "coran", "quran", "christian"],
      regional: ["regional", "region", "amazigh", "berber", "rif", "souss", "tachelhit", "tamazight"]
    };
    return groups[category].some((tag) => value.includes(tag));
  }

  function logoMarkup(station, className) {
    const logo = station.favicon || "";
    const fallback = `<span aria-hidden="true">♫</span>`;
    if (!logo || !/^https?:\/\//i.test(logo)) {
      return `<div class="station-logo ${className}">${fallback}</div>`;
    }
    return `<div class="station-logo ${className}"><img src="${escapeHTML(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='♫'"></div>`;
  }

  function stationCard(station) {
    const id = stationId(station);
    const isFavorite = favorites().includes(id);
    const isPlaying = activeStation && stationId(activeStation) === id && !audio.paused;
    const title = escapeHTML(station.name || "Unknown station");
    const language = (station.language || "Language not specified").split(",").slice(0, 2).map(s => s.trim()).join(", ");
    const bitrate = station.bitrate ? `${station.bitrate} kbps` : "Online radio";
    return `<article class="station-card">
      ${logoMarkup(station, "card-logo")}
      <div class="card-content"><h3 title="${title}">${title}</h3><p>${escapeHTML(language)} · ${escapeHTML(bitrate)}</p></div>
      <div class="card-actions">
        <button class="mini-play" type="button" data-play="${escapeHTML(id)}" aria-label="${isPlaying ? "Pause" : "Play"} ${title}" title="${isPlaying ? "Pause" : "Play"}">${isPlaying ? "Ⅱ" : "▶"}</button>
        <button class="favorite-button ${isFavorite ? "is-favorite" : ""}" type="button" data-favorite="${escapeHTML(id)}" aria-label="${isFavorite ? "Remove from" : "Add to"} favorites: ${title}" title="${isFavorite ? "Remove favorite" : "Add favorite"}">${isFavorite ? "♥" : "♡"}</button>
      </div>
    </article>`;
  }

  function getVisibleStations() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const language = languageFilter.value.toLowerCase();
    const category = categoryFilter.value;
    let list = stations.filter(station => {
      const searchable = `${station.name || ""} ${station.tags || ""} ${station.language || ""} ${station.state || ""}`.toLocaleLowerCase();
      return (!query || searchable.includes(query))
        && (!language || (station.language || "").toLowerCase().split(",").map(x => x.trim()).includes(language))
        && matchesCategory(station, category);
    });
    if (currentView === "favorites") {
      const ids = new Set(favorites());
      list = list.filter(station => ids.has(stationId(station)));
    } else if (currentView === "recent") {
      const ids = recent();
      list = ids.map(id => stations.find(station => stationId(station) === id)).filter(Boolean);
      list = list.filter(station => {
        const searchable = `${station.name || ""} ${station.tags || ""} ${station.language || ""} ${station.state || ""}`.toLowerCase();
        return (!query || searchable.includes(query))
          && (!language || (station.language || "").toLowerCase().split(",").map(x => x.trim()).includes(language))
          && matchesCategory(station, category);
      });
    }
    return list;
  }

  function render() {
    $("#all-count").textContent = stations.length || "—";
    $("#favorites-count").textContent = favorites().length;
    const visible = getVisibleStations();
    grid.innerHTML = visible.map(stationCard).join("");
    $("#empty-state").hidden = visible.length > 0;
    grid.hidden = visible.length === 0;
    if (stations.length) {
      const label = currentView === "favorites" ? "favorite stations" : currentView === "recent" ? "recently played stations" : "stations";
      status.textContent = `${visible.length} ${label}${visible.length === 1 ? "" : ""}`;
    }
  }

  function populateLanguages() {
    const selected = languageFilter.value;
    const languages = new Set();
    stations.forEach(station => (station.language || "").split(",").forEach(language => {
      const clean = language.trim();
      if (clean) languages.add(clean);
    }));
    languageFilter.innerHTML = '<option value="">All languages</option>' +
      [...languages].sort((a, b) => a.localeCompare(b)).map(language =>
        `<option value="${escapeHTML(language.toLowerCase())}">${escapeHTML(language)}</option>`
      ).join("");
    if ([...languageFilter.options].some(option => option.value === selected)) languageFilter.value = selected;
  }

  async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadStations({ quiet = false } = {}) {
    if (requestInProgress) return;
    requestInProgress = true;
    if (!quiet) {
      status.textContent = "Loading Moroccan stations from the live directory…";
      $("#refresh-button").disabled = true;
    }
    let lastError;
    for (const server of [apiBase, ...API_SERVERS.filter(item => item !== apiBase)]) {
      try {
        const url = `${server}/json/stations/search?${new URLSearchParams({
          countrycode: "MA", limit: "500", hidebroken: "true", order: "votes", reverse: "true"
        })}`;
        const data = await fetchWithTimeout(url);
        if (!Array.isArray(data)) throw new Error("Unexpected station directory response");
        apiBase = server;
        stations = data.filter(station => station && (station.url_resolved || station.url))
          .filter((station, index, all) => all.findIndex(item => stationId(item) === stationId(station)) === index);
        populateLanguages();
        render();
        const now = new Date();
        $("#updated-at").textContent = `Directory refreshed ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        if (!quiet) status.textContent = `${stations.length} Moroccan stations loaded. Select any station to listen.`;
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (!stations.length) {
      status.textContent = "Could not load the live directory. Check your connection and try Refresh stations.";
      grid.innerHTML = "";
      $("#empty-state").hidden = false;
      $("#empty-state").querySelector("h3").textContent = "Directory unavailable";
      $("#empty-state").querySelector("p").textContent = "The station directory may be temporarily unreachable. Your favorites remain saved in this browser.";
      grid.hidden = true;
    } else if (!quiet) {
      status.textContent = `Refresh failed; showing the last loaded directory. ${lastError ? "" : ""}`;
    }
  }

  function rememberRecent(station) {
    const id = stationId(station);
    const updated = [id, ...recent().filter(item => item !== id)].slice(0, 12);
    safeWrite(STORAGE.recent, updated);
  }

  function setPlayerStation(station) {
    if (!station) return;
    activeStation = station;
    const id = stationId(station);
    const stream = station.url_resolved || station.url;
    $("#now-name").textContent = station.name || "Unknown station";
    $("#now-meta").textContent = [station.language, station.bitrate ? `${station.bitrate} kbps` : ""].filter(Boolean).join(" · ") || "Moroccan radio";
    const nowLogo = $("#now-logo");
    nowLogo.innerHTML = "";
    if (station.favicon && /^https?:\/\//i.test(station.favicon)) {
      const img = new Image();
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.src = station.favicon;
      img.onerror = () => { nowLogo.textContent = "♫"; };
      nowLogo.appendChild(img);
    } else nowLogo.textContent = "♫";
    audio.src = stream;
    audio.load();
    playToggle.disabled = false;
    playToggle.textContent = "▶";
    playerStatus.textContent = "Ready to play. Press the play button.";
    rememberRecent(station);
    render();
  }

  async function playStation(station) {
    if (!station) return;
    const sameStation = activeStation && stationId(activeStation) === stationId(station);
    if (sameStation && !audio.paused) {
      audio.pause();
      return;
    }
    if (!sameStation || audio.src !== (station.url_resolved || station.url)) setPlayerStation(station);
    playToggle.disabled = false;
    playerStatus.textContent = "Connecting to station…";
    try {
      await audio.play();
      playToggle.textContent = "Ⅱ";
      playerStatus.textContent = "Live stream playing.";
      rememberRecent(station);
      render();
    } catch (error) {
      playToggle.textContent = "▶";
      playerStatus.textContent = "Playback failed. This stream may be offline or block browser playback; try another station.";
      render();
    }
  }

  function toggleFavorite(id) {
    const current = favorites();
    const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current];
    safeWrite(STORAGE.favorites, next);
    render();
  }

  grid.addEventListener("click", event => {
    const playButton = event.target.closest("[data-play]");
    const favoriteButton = event.target.closest("[data-favorite]");
    if (playButton) {
      const station = stations.find(item => stationId(item) === playButton.dataset.play);
      if (station) playStation(station);
    } else if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favorite);
    }
  });

  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    currentView = tab.dataset.view;
    document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
    render();
  }));
  [searchInput, languageFilter, categoryFilter].forEach(element => element.addEventListener(
    element === searchInput ? "input" : "change", render
  ));
  $("#clear-filters").addEventListener("click", () => {
    searchInput.value = ""; languageFilter.value = ""; categoryFilter.value = ""; render();
  });
  $("#refresh-button").addEventListener("click", () => loadStations());
  $("#theme-toggle").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  playToggle.addEventListener("click", async () => {
    if (!activeStation) return;
    if (audio.paused) await playStation(activeStation);
    else audio.pause();
  });
  $("#volume").addEventListener("input", event => { audio.volume = Number(event.target.value); });
  audio.volume = 0.8;
  audio.addEventListener("playing", () => {
    playToggle.textContent = "Ⅱ";
    playerStatus.textContent = "Live stream playing.";
    render();
  });
  audio.addEventListener("pause", () => {
    playToggle.textContent = "▶";
    if (activeStation) playerStatus.textContent = "Playback paused.";
    render();
  });
  audio.addEventListener("waiting", () => { playerStatus.textContent = "Buffering stream…"; });
  audio.addEventListener("error", () => {
    if (activeStation) playerStatus.textContent = "This station's stream could not be played. Try another station.";
  });

  applyTheme((() => { try { return localStorage.getItem(STORAGE.theme) || "light"; } catch { return "light"; } })());
  loadStations();
  refreshTimer = setInterval(() => loadStations({ quiet: true }), REFRESH_INTERVAL_MS);
  window.addEventListener("online", () => loadStations({ quiet: true }));
  window.addEventListener("beforeunload", () => clearInterval(refreshTimer));
})();
