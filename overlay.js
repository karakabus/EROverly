let state = null;
const openRegions = new Map();
let panelCollapsed = false;
let previousBossContext = null;
let previousBossUpdatedAt = null;
let previousBossStates = new Map();
let pendingRegionFocusKey = null;

function render(s) {
  const progress = s.bossProgress;
  const latestKilledRegion = detectLatestKilledRegion(s, progress);
  if (latestKilledRegion) {
    openRegions.set(latestKilledRegion.key, true);
    pendingRegionFocusKey = latestKilledRegion.key;
  }
  state = s;
  updatePanelCollapseState();
  document.getElementById("challengeTitle").textContent = s.title || "";
  document.getElementById("bossSummary").textContent = progress
    ? `${progress.killed}/${progress.total}`
    : "0/207";
  updateGameTime();
  updateDeathCounter();
  document.getElementById("characterLabel").textContent = formatCharacter(s);
  document.getElementById("saveStatus").textContent = formatSaveStatus(s.saveStatus, progress);
  renderRegions(progress);
}

function updatePanelCollapseState() {
  document.body.classList.toggle("panel-collapsed", panelCollapsed);
  const summary = document.getElementById("bossSummary");
  if (summary) summary.setAttribute("aria-expanded", String(!panelCollapsed));
}

function togglePanelCollapsed() {
  panelCollapsed = !panelCollapsed;
  updatePanelCollapseState();
}

function updateGameTime() {
  const node = document.getElementById("gameTime");
  if (node) node.textContent = formatGameTime(state);
}

function updateDeathCounter() {
  const node = document.getElementById("deathCounter");
  if (!node) return;
  const visible = !state || state.showDeathCounter !== false;
  node.hidden = !visible;
  node.textContent = visible ? formatDeathCounter(state) : "";
}

function renderRegions(progress) {
  const node = document.getElementById("regionList");
  node.innerHTML = "";

  if (!progress || !progress.regions) {
    node.innerHTML = `<div class="empty-line">Boss listesi bekleniyor</div>`;
    return;
  }

  const firstIncomplete = progress.regions.findIndex(region => region.killed < region.total);
  const autoOpenIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
  let focusSection = null;

  progress.regions.forEach((region, index) => {
    const regionKey = getRegionKey(region);
    const isOpen = openRegions.has(regionKey) ? openRegions.get(regionKey) : index === autoOpenIndex;
    const section = document.createElement("section");
    section.className = "region-section";
    section.dataset.regionKey = regionKey;
    if (region.killed === region.total) section.classList.add("complete");

    const header = document.createElement("button");
    header.className = "region-header";
    header.type = "button";
    header.innerHTML = `
      <span class="chevron">${isOpen ? "▾" : "▸"}</span>
      <span class="region-count">${region.killed}/${region.total}</span>
      <span class="region-name">${escapeHtml(region.regionName)}</span>
      ${region.dlc ? `<span class="dlc-tag">DLC</span>` : ""}
    `;
    header.addEventListener("click", () => {
      openRegions.set(regionKey, !isOpen);
      render(state);
    });
    section.appendChild(header);

    if (isOpen) {
      const list = document.createElement("div");
      list.className = "boss-list";
      const repeatedNames = new Set(
        (region.bosses || [])
          .map(boss => boss.name)
          .filter((name, _, names) => names.indexOf(name) !== names.lastIndexOf(name))
      );
      region.bosses.forEach(boss => {
        const suffix = boss.place && repeatedNames.has(boss.name) ? ` (${boss.place})` : "";
        const row = document.createElement("div");
        row.className = `boss-row ${boss.killed ? "killed" : ""}`;
        row.title = boss.place ? `${boss.name} - ${boss.place}` : boss.name;
        row.innerHTML = `
          <span class="boss-check">${boss.killed ? "✓" : ""}</span>
          <span class="boss-name">${escapeHtml(boss.name + suffix)}</span>
        `;
        list.appendChild(row);
      });
      section.appendChild(list);
    }

    node.appendChild(section);
    if (regionKey === pendingRegionFocusKey) focusSection = section;
  });

  if (focusSection && pendingRegionFocusKey) {
    const focusKey = pendingRegionFocusKey;
    requestAnimationFrame(() => {
      if (!focusSection.isConnected || pendingRegionFocusKey !== focusKey) return;
      const listRect = node.getBoundingClientRect();
      const sectionRect = focusSection.getBoundingClientRect();
      const targetTop = Math.max(0, node.scrollTop + sectionRect.top - listRect.top);
      node.scrollTo({ top: targetTop, behavior: "smooth" });
      pendingRegionFocusKey = null;
    });
  }
}

function getRegionKey(region) {
  return `${region && region.dlc ? "dlc" : "base"}:${region?.regionName || ""}`;
}

function bossProgressContext(s, progress) {
  const slot = Number.isInteger(s?.selectedCharacterSlot) ? s.selectedCharacterSlot : "none";
  const mode = s?.bossListMode || "allBosses";
  const includeDlc = s?.includeDlc === false ? "base" : "all";
  const bossIds = (progress?.regions || [])
    .flatMap(region => (region.bosses || []).map(boss => boss.id))
    .join(",");
  return `${slot}|${mode}|${includeDlc}|${bossIds}`;
}

function snapshotBossStates(progress) {
  const snapshot = new Map();
  for (const region of progress?.regions || []) {
    for (const boss of region.bosses || []) snapshot.set(boss.id, Boolean(boss.killed));
  }
  return snapshot;
}

function detectLatestKilledRegion(s, progress) {
  if (!progress || !Array.isArray(progress.regions) || progress.readable === false || progress.error) {
    previousBossContext = null;
    previousBossUpdatedAt = null;
    previousBossStates = new Map();
    return null;
  }

  const context = bossProgressContext(s, progress);
  const updatedAt = Number(progress.updatedAt);
  if (context !== previousBossContext) {
    previousBossContext = context;
    previousBossUpdatedAt = Number.isFinite(updatedAt) ? updatedAt : null;
    previousBossStates = snapshotBossStates(progress);
    return null;
  }
  if (
    Number.isFinite(updatedAt) &&
    Number.isFinite(previousBossUpdatedAt) &&
    updatedAt <= previousBossUpdatedAt
  ) {
    return null;
  }

  let latest = null;
  for (const region of progress.regions) {
    for (const boss of region.bosses || []) {
      if (previousBossStates.get(boss.id) === false && boss.killed === true) {
        latest = { key: getRegionKey(region), bossId: boss.id };
      }
    }
  }

  previousBossStates = snapshotBossStates(progress);
  previousBossUpdatedAt = Number.isFinite(updatedAt) ? updatedAt : previousBossUpdatedAt;
  return latest;
}

function applyLiveBossState(message) {
  const progress = state?.bossProgress;
  if (!progress || !Array.isArray(progress.regions)) return false;

  for (const region of progress.regions) {
    const boss = (region.bosses || []).find(item => item.id === message.bossId);
    if (!boss) continue;
    const dead = Boolean(message.dead);
    const changed = Boolean(boss.killed) !== dead;
    boss.killed = dead;
    region.killed = (region.bosses || []).reduce((sum, item) => sum + (item.killed ? 1 : 0), 0);
    progress.killed = progress.regions.reduce((sum, item) => sum + (item.killed || 0), 0);
    return changed;
  }
  return false;
}

function handleBossStateChange(message) {
  if (!message || !message.bossId) return;
  previousBossStates.set(message.bossId, Boolean(message.dead));
  const changed = applyLiveBossState(message);

  if (message.dead && message.newlyKilled) {
    const regionKey = `${message.dlc ? "dlc" : "base"}:${message.regionName || ""}`;
    openRegions.set(regionKey, true);
    pendingRegionFocusKey = regionKey;
  }

  if (state?.bossProgress && (changed || pendingRegionFocusKey)) render(state);
}

function formatCharacter(s) {
  if (!s || !s.selectedCharacter) return "Karakter yok";
  const slot = Number.isInteger(s.selectedCharacter.slot) ? s.selectedCharacter.slot + 1 : "-";
  return `${slot}. ${s.selectedCharacter.name || "Empty"}`;
}

function formatGameTime(s) {
  if (!s || !s.selectedCharacter || !Number.isFinite(s.selectedCharacter.playTimeSeconds)) return "";
  const readAt = Number(s.selectedCharacter.playTimeReadAt);
  const elapsed = Number.isFinite(readAt) ? Math.max(0, (Date.now() - readAt) / 1000) : 0;
  return `Oyun Süresi ${formatDuration(s.selectedCharacter.playTimeSeconds + elapsed)}`;
}

function formatDeathCounter(s) {
  const deaths = s && s.selectedCharacter ? Number(s.selectedCharacter.deathCount) : NaN;
  return Number.isFinite(deaths) ? `Ölüm: ${Math.max(0, Math.floor(deaths))}` : "Ölüm: -";
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatSaveStatus(saveStatus, progress) {
  if (!saveStatus || !saveStatus.configured) return "SAVE: yol yok";
  if (saveStatus.error) return `SAVE: ${saveStatus.error}`;
  if (!saveStatus.exists) return "SAVE: bekleniyor";
  if (progress && progress.error) return progress.error;
  return "";
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function connect() {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "state") render(msg.state);
    if (msg.type === "boss-state-changed") handleBossStateChange(msg);
  };
  ws.onclose = () => setTimeout(connect, 1000);
}

function loadInitialState() {
  fetch("/api/state", { cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .then(nextState => {
      if (nextState) render(nextState);
    })
    .catch(() => {});
}

document.getElementById("bossSummary").addEventListener("click", togglePanelCollapsed);
document.getElementById("bossSummary").addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  togglePanelCollapsed();
});

loadInitialState();
connect();
setInterval(updateGameTime, 1000);
