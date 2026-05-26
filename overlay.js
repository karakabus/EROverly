let state = null;
const openRegions = new Map();
let panelCollapsed = false;

function render(s) {
  state = s;
  const progress = s.bossProgress;
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

  progress.regions.forEach((region, index) => {
    const isOpen = openRegions.has(index) ? openRegions.get(index) : index === autoOpenIndex;
    const section = document.createElement("section");
    section.className = "region-section";
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
      openRegions.set(index, !isOpen);
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
  });
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
