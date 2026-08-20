let state = null;
let socket = null;
let customBossDropdownOpen = false;
let customBossSearch = "";
let customBossControlsRenderKey = "";
let uiLanguage = resolveInitialLanguage();
let layoutResizeState = null;

const i18n = {
  en: {
    language: "Language",
    challengeTitle: "Challenge Title",
    challengeTitlePlaceholder: "Challenge name",
    saveFile: "Save File",
    chooseSaveFile: "Choose Save File",
    uploadingSaveFile: "Uploading save file...",
    selectedSaveFile: "Selected save file",
    saveFileUploadFailed: "Save file selection failed",
    hotkeyProgram: "Hotkey Program",
    openHotkeyProgram: "Open Hotkey Program",
    hotkeyProgramHint: "Build your own macros with triggers, key taps, holds, releases, and timed waits.",
    bossList: "Boss List",
    includeDlc: "Include DLC",
    showDeathCounter: "Show Death Counter",
    listType: "List Type",
    allBosses: "All Bosses",
    allRemembrances: "All Remembrances",
    customBosses: "Custom Bosses",
    platinumTrophy: "Platinum Trophy",
    addRow: "Add Row",
    closeList: "Close List",
    bossCount: "boss",
    bossSearch: "Search boss",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    preview: "Preview",
    saveWatcher: "Save Watcher",
    bosses: "Bosses",
    platinum: "Platinum",
    optionalDlc: "DLC Optional",
    trophyTask: "Trophy / Task",
    requirement: "Requirement",
    type: "Type",
    source: "Source",
    auto: "Auto",
    manual: "Manual",
    ending: "Ending",
    shardbearer: "Shardbearer",
    legendaryFoe: "Legendary Foe",
    greaterFoe: "Greater Foe",
    collection: "Collection",
    misc: "Misc",
    dlcBoss: "DLC Boss",
    status: "Status",
    done: "DONE",
    wait: "WAIT",
    noSavePath: "No path in save_file_path.js.",
    characterSlot: "Character Slot",
    slotUnreadable: "Slot unreadable",
    boss: "Boss",
    path: "Path",
    size: "Size",
    hash: "Hash",
    changed: "Changed",
    checked: "Checked"
  },
  tr: {
    language: "Dil",
    challengeTitle: "Challenge Başlığı",
    challengeTitlePlaceholder: "Challenge adı",
    saveFile: "Save Dosyası",
    chooseSaveFile: "Save Dosyası Seç",
    uploadingSaveFile: "Save dosyası yükleniyor...",
    selectedSaveFile: "Seçilen save dosyası",
    saveFileUploadFailed: "Save dosyası seçilemedi",
    hotkeyProgram: "Hotkey Programı",
    openHotkeyProgram: "Hotkey Programını Aç",
    hotkeyProgramHint: "Tetikleyici, basma, basılı tutma, bırakma ve bekleme adımlarından kendi makrolarını oluştur.",
    bossList: "Boss Listesi",
    includeDlc: "DLC Dahil",
    showDeathCounter: "Ölüm Sayacını Göster",
    listType: "Liste Tipi",
    allBosses: "Tüm Bosslar",
    allRemembrances: "Tüm Remembrance Bossları",
    customBosses: "Custom Bosses",
    platinumTrophy: "Platinum Kupa",
    addRow: "Satır Ekle",
    closeList: "Listeyi Kapat",
    bossCount: "boss",
    bossSearch: "Boss ara",
    moveUp: "Yukarı taşı",
    moveDown: "Aşağı taşı",
    remove: "Sil",
    preview: "Preview",
    saveWatcher: "Save Watcher",
    bosses: "Bosslar",
    platinum: "Platinum",
    optionalDlc: "DLC Opsiyonel",
    trophyTask: "Kupa / Görev",
    requirement: "Gereksinim",
    type: "Tip",
    source: "Kaynak",
    auto: "Otomatik",
    manual: "Manuel",
    ending: "Son",
    shardbearer: "Shardbearer",
    legendaryFoe: "Legendary Boss",
    greaterFoe: "Greater Boss",
    collection: "Koleksiyon",
    misc: "Diğer",
    dlcBoss: "DLC Boss",
    status: "Durum",
    done: "TAMAM",
    wait: "BEKLE",
    noSavePath: "save_file_path.js içinde yol yok.",
    characterSlot: "Karakter Slotu",
    slotUnreadable: "Slot okunamadı",
    boss: "Boss",
    path: "Path",
    size: "Size",
    hash: "Hash",
    changed: "Changed",
    checked: "Checked"
  }
};

function resolveInitialLanguage() {
  try {
    const saved = localStorage.getItem("erOverlayControlLanguage");
    if (saved === "en" || saved === "tr") return saved;
  } catch (_) {}
  const browserLanguage = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  return browserLanguage.startsWith("tr") ? "tr" : "en";
}

function text(key) {
  return (i18n[uiLanguage] && i18n[uiLanguage][key]) || i18n.en[key] || key;
}

function localized(value) {
  if (!value || typeof value !== "object") return value || "";
  return value[uiLanguage] || value.en || value.tr || "";
}

function clampLeftPanelWidth(value) {
  const min = 320;
  const max = Math.max(min, Math.min(760, window.innerWidth - 420));
  return Math.min(max, Math.max(min, Math.round(value)));
}

function setLeftPanelWidth(value) {
  const width = clampLeftPanelWidth(value);
  document.documentElement.style.setProperty("--control-left-width", `${width}px`);
  return width;
}

function restoreLeftPanelWidth() {
  let saved = null;
  try {
    saved = Number(localStorage.getItem("erOverlayControlLeftWidth"));
  } catch (_) {}
  if (Number.isFinite(saved)) {
    setLeftPanelWidth(saved);
  }
}

function initLayoutResize() {
  const handle = document.getElementById("layoutResizeHandle");
  if (!handle) return;

  handle.addEventListener("pointerdown", event => {
    const current = getComputedStyle(document.documentElement).getPropertyValue("--control-left-width").trim();
    const currentWidth = Number.parseFloat(current) || 380;
    layoutResizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: currentWidth
    };
    document.body.classList.add("is-resizing-layout");
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", event => {
    if (!layoutResizeState || layoutResizeState.pointerId !== event.pointerId) return;
    const width = setLeftPanelWidth(layoutResizeState.startWidth + event.clientX - layoutResizeState.startX);
    try {
      localStorage.setItem("erOverlayControlLeftWidth", String(width));
    } catch (_) {}
  });

  function stopResize(event) {
    if (!layoutResizeState || layoutResizeState.pointerId !== event.pointerId) return;
    layoutResizeState = null;
    document.body.classList.remove("is-resizing-layout");
  }

  handle.addEventListener("pointerup", stopResize);
  handle.addEventListener("pointercancel", stopResize);
}

function connect() {
  socket = new WebSocket(`ws://${location.host}`);
  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "state") {
      state = msg.state;
      render();
    }
  };
  socket.onclose = () => setTimeout(connect, 1000);
}

function send(action) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "action", action }));
  } else {
    fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action)
    });
  }
}

function renderSaveFileUploadStatus(message, type) {
  const node = document.getElementById("saveFileUploadStatus");
  if (!node) return;
  node.textContent = message || "";
  node.className = `field-hint ${type ? `is-${type}` : ""}`;
}

function uploadSelectedSaveFile(file) {
  if (!file) return;
  renderSaveFileUploadStatus(text("uploadingSaveFile"), "pending");

  fetch("/api/save-file", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Save-File-Name": encodeURIComponent(file.name)
    },
    body: file
  })
    .then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || response.statusText);
      }
      renderSaveFileUploadStatus(`${text("selectedSaveFile")}: ${file.name}`, "done");
    })
    .catch(err => {
      renderSaveFileUploadStatus(`${text("saveFileUploadFailed")}: ${err.message || err}`, "error");
    });
}

function render() {
  if (!state) return;
  renderStaticText();
  const progress = state.bossProgress;
  const bosses = flattenBosses(progress);
  const isPlatinumMode = state.bossListMode === "platinumChecklist";

  document.getElementById("status").textContent =
    isPlatinumMode
      ? formatPlatinumStatus(state.platinumChecklist)
      : (progress ? `${text("bosses")} — ${progress.killed} / ${progress.total}` : text("bosses"));
  renderChallengeTitle();
  renderCharacterSlot(state.saveStatus);
  renderIncludeDlc();
  renderShowDeathCounter();
  renderBossListMode();
  renderSaveStatus(state.saveStatus);

  if (isPlatinumMode) {
    renderPlatinumChecklist(state.platinumChecklist);
  } else {
    renderBossTable(bosses);
  }
}

function formatPlatinumStatus(checklist) {
  const official = checklist && checklist.official;
  return official ? `${text("platinum")} — ${official.completed} / ${official.total}` : text("platinum");
}

function renderStaticText() {
  document.documentElement.lang = uiLanguage;
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = text(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.placeholder = text(node.dataset.i18nPlaceholder);
  });
  const input = document.getElementById("languageSelect");
  if (input && document.activeElement !== input) {
    input.value = uiLanguage;
  }
}

function renderChallengeTitle() {
  const input = document.getElementById("challengeTitleInput");
  if (!input || document.activeElement === input) return;
  input.value = state.title || "";
}

function renderIncludeDlc() {
  const input = document.getElementById("includeDlcSwitch");
  if (!input || document.activeElement === input) return;
  input.checked = state.includeDlc !== false;
}

function renderShowDeathCounter() {
  const input = document.getElementById("showDeathCounterSwitch");
  if (!input || document.activeElement === input) return;
  input.checked = state.showDeathCounter !== false;
}

function renderBossListMode() {
  const input = document.getElementById("bossListModeSelect");
  if (input && document.activeElement !== input) {
    input.value = state.bossListMode || "allBosses";
  }

  const node = document.getElementById("customBossControls");
  if (!node) return;
  if (state.bossListMode !== "customBosses") {
    customBossDropdownOpen = false;
    customBossSearch = "";
    customBossControlsRenderKey = "";
    node.innerHTML = "";
    return;
  }

  const ids = Array.isArray(state.customBossIds) ? state.customBossIds : [];
  const catalogIds = (state.bossCatalog || []).map(boss => boss.id).join("|");
  const nextRenderKey = [
    state.bossListMode || "allBosses",
    uiLanguage,
    state.includeDlc !== false ? "dlc" : "base",
    customBossDropdownOpen ? "open" : "closed",
    ids.join("|"),
    catalogIds
  ].join("::");

  if (customBossControlsRenderKey === nextRenderKey) {
    return;
  }

  customBossControlsRenderKey = nextRenderKey;
  node.innerHTML = `
    <div class="custom-boss-toolbar">
      <div class="custom-boss-picker-wrap">
        <button type="button" onclick="toggleCustomBossDropdown()">${customBossDropdownOpen ? text("closeList") : text("addRow")}</button>
        ${customBossDropdownOpen ? renderCustomBossPicker(ids) : ""}
      </div>
      <span>${ids.length} ${text("bossCount")}</span>
    </div>
    <div class="custom-boss-list">
      ${ids.map((bossId, index) => renderCustomBossRow(bossId, index, ids)).join("")}
    </div>
  `;
  if (customBossDropdownOpen && customBossSearch) {
    filterCustomBossChoices(customBossSearch);
  }
}

function renderBossTable(bosses) {
  const head = document.getElementById("progressTableHead");
  const body = document.getElementById("bossTable");
  if (!head || !body) return;

  head.innerHTML = `
    <tr>
      <th>#</th>
      <th>Boss</th>
      <th>Region</th>
      <th>Place</th>
      <th>Flag</th>
      <th>${escapeHtml(text("status"))}</th>
    </tr>
  `;
  body.innerHTML = bosses.map((b, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(b.name)} ${b.dlc ? `<span class="mini-tag">DLC</span>` : ""}</td>
      <td>${escapeHtml(b.regionName || "")}</td>
      <td>${escapeHtml(b.place || "")}</td>
      <td>${escapeHtml(String(b.flagId || ""))}</td>
      <td><span class="badge ${b.killed ? "done" : "pending"}">${b.killed ? text("done") : text("wait")}</span></td>
    </tr>
  `).join("");
}

function renderPlatinumChecklist(checklist) {
  const head = document.getElementById("progressTableHead");
  const body = document.getElementById("bossTable");
  if (!head || !body) return;

  head.innerHTML = `
    <tr>
      <th>#</th>
      <th>${escapeHtml(text("trophyTask"))}</th>
      <th>${escapeHtml(text("requirement"))}</th>
      <th>${escapeHtml(text("type"))}</th>
      <th>${escapeHtml(text("source"))}</th>
      <th>${escapeHtml(text("status"))}</th>
    </tr>
  `;

  if (!checklist || !checklist.official) {
    body.innerHTML = "";
    return;
  }

  const sections = [
    renderPlatinumSection(text("platinum"), checklist.official, 1),
    checklist.dlcOptional && checklist.dlcOptional.items && checklist.dlcOptional.items.length
      ? renderPlatinumSection(text("optionalDlc"), checklist.dlcOptional, checklist.official.items.length + 1)
      : ""
  ];
  body.innerHTML = sections.join("");
}

function renderPlatinumSection(title, section, startIndex) {
  const items = Array.isArray(section.items) ? section.items : [];
  return `
    <tr class="platinum-section-row">
      <td colspan="6">
        <span>${escapeHtml(title)}</span>
        <strong>${section.completed || 0} / ${section.total || items.length}</strong>
      </td>
    </tr>
    ${items.map((item, index) => renderPlatinumItem(item, startIndex + index)).join("")}
  `;
}

function renderPlatinumItem(item, index) {
  const completed = Boolean(item.completed);
  const typeKey = item.type || item.group || "misc";
  const sourceKey = item.source === "auto" ? "auto" : "manual";
  const bossMeta = item.boss
    ? `<div class="platinum-meta">${escapeHtml(item.boss.regionName || "")}${item.boss.place ? ` - ${escapeHtml(item.boss.place)}` : ""}</div>`
    : "";
  const status = item.readonly
    ? `<span class="badge ${completed ? "done" : "pending"}">${completed ? text("done") : text("wait")}</span>`
    : `
      <label class="platinum-checkbox">
        <input
          type="checkbox"
          data-id="${escapeHtml(item.id)}"
          ${completed ? "checked" : ""}
          onchange="setPlatinumChecklistItem(this.dataset.id, this.checked)"
        >
        <span class="badge ${completed ? "done" : "pending"}">${completed ? text("done") : text("wait")}</span>
      </label>
    `;

  return `
    <tr class="platinum-row ${completed ? "is-complete" : ""}">
      <td>${index}</td>
      <td>
        <strong>${escapeHtml(localized(item.title))}</strong>
        ${bossMeta}
      </td>
      <td>${escapeHtml(localized(item.requirement))}</td>
      <td>${escapeHtml(text(typeKey))}</td>
      <td>${escapeHtml(text(sourceKey))}</td>
      <td>${status}</td>
    </tr>
  `;
}

function renderCustomBossRow(bossId, index, ids) {
  const boss = findBossById(bossId);
  if (!boss) return "";
  return `
    <div class="custom-boss-row">
      <span class="custom-boss-index">${index + 1}</span>
      <div class="custom-boss-name">${escapeHtml(formatBossOption(boss))}</div>
      <button type="button" title="${escapeHtml(text("moveUp"))}" onclick="send({type:'moveCustomBoss', index:${index}, direction:-1})">↑</button>
      <button type="button" title="${escapeHtml(text("moveDown"))}" onclick="send({type:'moveCustomBoss', index:${index}, direction:1})">↓</button>
      <button type="button" class="danger" title="${escapeHtml(text("remove"))}" onclick="send({type:'removeCustomBoss', index:${index}})">×</button>
    </div>
  `;
}

function renderCustomBossPicker(ids) {
  const used = new Set(ids);
  const bosses = (state.bossCatalog || []).filter(boss => state.includeDlc !== false || !boss.dlc);
  return `
    <div class="custom-boss-picker">
      <input
        id="customBossSearchInput"
        class="custom-boss-search"
        type="search"
        placeholder="${escapeHtml(text("bossSearch"))}"
        value="${escapeHtml(customBossSearch)}"
        oninput="setCustomBossSearch(this.value); filterCustomBossChoices(this.value)"
      >
      ${bosses.map(boss => `
        <label class="custom-boss-choice" data-search="${escapeHtml(formatBossOption(boss).toLocaleLowerCase("tr-TR"))}">
          <input
            type="checkbox"
            value="${escapeHtml(boss.id)}"
            ${used.has(boss.id) ? "checked" : ""}
            onchange="setCustomBossChecked(this.value, this.checked)"
          >
          <span>${escapeHtml(formatBossOption(boss))}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function formatBossOption(boss) {
  const place = boss.place ? ` - ${boss.place}` : "";
  const dlc = boss.dlc ? " [DLC]" : "";
  return `${boss.name}${place} (${boss.regionName})${dlc}`;
}

function findBossById(bossId) {
  return (state.bossCatalog || []).find(boss => boss.id === bossId) || null;
}

function toggleCustomBossDropdown() {
  customBossDropdownOpen = !customBossDropdownOpen;
  customBossSearch = "";
  customBossControlsRenderKey = "";
  render();
}

function setCustomBossSearch(value) {
  customBossSearch = String(value || "");
}

function filterCustomBossChoices(query) {
  const needle = String(query || "").trim().toLocaleLowerCase("tr-TR");
  document.querySelectorAll(".custom-boss-choice").forEach(choice => {
    const filteredOut = Boolean(needle) && !(choice.dataset.search || "").includes(needle);
    choice.classList.toggle("is-filtered-out", filteredOut);
  });
}

function setCustomBossChecked(bossId, checked) {
  send({ type: checked ? "addCustomBoss" : "removeCustomBossById", bossId });
}

function setPlatinumChecklistItem(id, completed) {
  send({ type: "setPlatinumChecklistItem", id, completed });
}

function flattenBosses(progress) {
  if (!progress || !progress.regions) return [];
  return progress.regions.flatMap(region => (region.bosses || []).map(boss => ({
    ...boss,
    regionName: boss.regionName || region.regionName,
    dlc: boss.dlc || region.dlc
  })));
}

function renderSaveStatus(saveStatus) {
  const node = document.getElementById("saveStatus");
  if (!node) return;

  if (!saveStatus || !saveStatus.configured) {
    node.innerHTML = `<div class="badge pending">${text("wait")}</div><div>${escapeHtml(text("noSavePath"))}</div>`;
    return;
  }

  const changed = saveStatus.lastChangedAt ? new Date(saveStatus.lastChangedAt).toLocaleString("tr-TR") : "-";
  const checked = saveStatus.lastCheckedAt ? new Date(saveStatus.lastCheckedAt).toLocaleTimeString("tr-TR") : "-";
  const sizeMb = saveStatus.size ? (saveStatus.size / 1024 / 1024).toFixed(2) : "-";
  const shortHash = saveStatus.hash ? saveStatus.hash.slice(0, 10) : "-";
  const progress = state.bossProgress;
  const stateBadge = saveStatus.error || !saveStatus.exists
    ? `<span class="badge pending">${text("wait")}</span>`
    : `<span class="badge done">OK</span>`;
  node.innerHTML = `
    <div>${stateBadge}</div>
    <div><strong>${escapeHtml(text("boss"))}:</strong> ${progress ? `${progress.killed} / ${progress.total}` : "-"}</div>
    <div><strong>${escapeHtml(text("path"))}:</strong> ${escapeHtml(saveStatus.path || "-")}</div>
    <div><strong>${escapeHtml(text("size"))}:</strong> ${escapeHtml(sizeMb)} MB</div>
    <div><strong>${escapeHtml(text("hash"))}:</strong> ${escapeHtml(shortHash)}</div>
    <div><strong>${escapeHtml(text("changed"))}:</strong> ${escapeHtml(changed)}</div>
    <div><strong>${escapeHtml(text("checked"))}:</strong> ${escapeHtml(checked)}</div>
    ${progress && progress.error ? `<div class="save-error">${escapeHtml(progress.error)}</div>` : ""}
    ${saveStatus.error ? `<div class="save-error">${escapeHtml(saveStatus.error)}</div>` : ""}
  `;
}

function renderCharacterSlot(saveStatus) {
  const node = document.getElementById("characterSlotField");
  if (!node || document.activeElement?.id === "characterSlot") return;
  const characters = (saveStatus?.characters || []).filter(character => character.active);
  const selectedSlot = Number.isInteger(state.selectedCharacterSlot) ? state.selectedCharacterSlot : "";
  const characterOptions = characters.length
    ? characters.map(character => {
      const label = `${character.slot + 1}. ${character.name}`;
      return `<option value="${character.slot}" ${character.slot === selectedSlot ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("")
    : `<option value="">${escapeHtml(text("slotUnreadable"))}</option>`;

  node.innerHTML = `
    <label class="field-label" for="characterSlot">${escapeHtml(text("characterSlot"))}</label>
    <select id="characterSlot" onchange="send({type:'selectCharacterSlot', slot:Number(this.value)})" ${characters.length ? "" : "disabled"}>
      ${characterOptions}
    </select>
  `;
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("challengeTitleInput").addEventListener("change", (e) => {
  send({ type: "setTitle", title: e.target.value });
});

document.getElementById("languageSelect").addEventListener("change", (e) => {
  uiLanguage = e.target.value === "tr" ? "tr" : "en";
  try {
    localStorage.setItem("erOverlayControlLanguage", uiLanguage);
  } catch (_) {}
  customBossControlsRenderKey = "";
  render();
});

document.getElementById("saveFileButton").addEventListener("click", () => {
  document.getElementById("saveFileInput").click();
});

document.getElementById("saveFileInput").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  uploadSelectedSaveFile(file);
  e.target.value = "";
});

document.getElementById("includeDlcSwitch").addEventListener("change", (e) => {
  send({ type: "setIncludeDlc", includeDlc: e.target.checked });
});

document.getElementById("showDeathCounterSwitch").addEventListener("change", (e) => {
  send({ type: "setShowDeathCounter", showDeathCounter: e.target.checked });
});

document.getElementById("bossListModeSelect").addEventListener("change", (e) => {
  send({ type: "setBossListMode", mode: e.target.value });
});

restoreLeftPanelWidth();
initLayoutResize();
renderStaticText();
connect();
