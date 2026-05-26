const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getBossProgress, getBossCatalog, getSaveStatus, startSaveWatcher } = require("./saveWatcher");
const { BASE_PLATINUM_ITEMS, MANUAL_PLATINUM_ITEM_IDS } = require("./platinumChecklist");

const PORT = Number(process.env.PORT || 3210);
const ROOT = __dirname;
const STATE_PATH = path.join(ROOT, "state.json");
const RUNTIME_DIR = path.join(ROOT, ".runtime");
const RUNTIME_SAVE_CONFIG_PATH = path.join(RUNTIME_DIR, "save-path.json");
const MAX_SAVE_UPLOAD_BYTES = 128 * 1024 * 1024;
const BOSS_LIST_MODES = new Set(["allBosses", "allRemembrances", "customBosses", "platinumChecklist"]);
const REMEMBRANCE_BOSS_IDS = [
  "2:1",
  "6:14",
  "12:4",
  "11:2",
  "17:1",
  "19:0",
  "15:2",
  "22:1",
  "15:1",
  "5:1",
  "21:2",
  "14:8",
  "18:3",
  "22:2",
  "20:2",
  "29:3",
  "24:14",
  "29:4",
  "23:6",
  "25:1",
  "23:5",
  "31:0",
  "30:1",
  "24:8",
  "26:2"
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function decodeHeaderValue(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (_) {
    return String(value || "");
  }
}

function saveUploadedSaveFile(req, res) {
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_SAVE_UPLOAD_BYTES) {
    res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "Save file is too large" }));
    return;
  }

  const originalName = path.basename(decodeHeaderValue(req.headers["x-save-file-name"]) || "selected-save.sl2");
  const ext = path.extname(originalName).toLowerCase();
  if (ext !== ".sl2" && ext !== ".co2") {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "Only .sl2 and .co2 files are supported" }));
    return;
  }

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const targetPath = path.join(RUNTIME_DIR, `selected-save${ext}`);
  const tempPath = path.join(RUNTIME_DIR, `selected-save${ext}.tmp`);
  const output = fs.createWriteStream(tempPath);
  let size = 0;
  let responded = false;

  function fail(status, message) {
    if (responded) return;
    responded = true;
    output.destroy();
    fs.unlink(tempPath, () => {});
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: message }));
  }

  output.on("error", err => {
    fail(500, String(err.message || err));
  });

  req.on("data", chunk => {
    if (responded) return;
    size += chunk.length;
    if (size > MAX_SAVE_UPLOAD_BYTES) {
      fail(413, "Save file is too large");
      req.destroy();
      return;
    }
    if (!output.write(chunk)) {
      req.pause();
      output.once("drain", () => req.resume());
    }
  });

  req.on("end", () => {
    if (responded) return;
    output.end(() => {
      if (responded) return;
      try {
        fs.renameSync(tempPath, targetPath);
        fs.writeFileSync(
          RUNTIME_SAVE_CONFIG_PATH,
          JSON.stringify({ path: targetPath, originalName, selectedAt: Date.now() }, null, 2),
          "utf8"
        );
        const saveStatus = getSaveStatus();
        broadcastState();
        responded = true;
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, saveStatus }));
      } catch (err) {
        fail(500, String(err.message || err));
      }
    });
  });

  req.on("error", err => {
    fail(400, String(err.message || err));
  });
}

function nowElapsed(state) {
  if (!state.running || !state.startedAt) return state.elapsedMs || 0;
  return (state.elapsedMs || 0) + (Date.now() - state.startedAt);
}

function normalizeState(state) {
  state.includeDlc = state.includeDlc !== false;
  state.showDeathCounter = state.showDeathCounter !== false;
  state.bossListMode = BOSS_LIST_MODES.has(state.bossListMode) ? state.bossListMode : "allBosses";
  state.customBossIds = normalizeBossIds(state.customBossIds, state.includeDlc);
  state.platinumManual = normalizePlatinumManual(state.platinumManual);
  state.splitIndex = state.bosses.findIndex(b => !b.killed);
  if (state.splitIndex < 0) state.splitIndex = state.bosses.length;
  state.totalNow = state.bosses.reduce((sum, b) => sum + (Number(b.now) || 0), 0);
  return state;
}

function normalizePlatinumManual(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  Object.entries(value).forEach(([id, completed]) => {
    if (completed && MANUAL_PLATINUM_ITEM_IDS.has(id)) {
      result[id] = true;
    }
  });
  return result;
}

function normalizeBossIds(value, includeDlc = true) {
  const knownIds = new Set(
    flattenBossCatalog()
      .filter(boss => includeDlc || !boss.dlc)
      .map(boss => boss.id)
  );
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map(id => String(id))
    .filter(id => knownIds.has(id) && !seen.has(id) && seen.add(id));
}

function resolveSelectedCharacter(state, saveStatus) {
  const characters = (saveStatus.characters || []).filter(character => character.active);
  const configuredSlot = Number.isInteger(state.selectedCharacterSlot) ? state.selectedCharacterSlot : null;
  const selectedCharacter = characters.find(c => c.slot === configuredSlot) || characters[0] || null;
  const selectedSlot = selectedCharacter ? selectedCharacter.slot : null;

  return { selectedCharacterSlot: selectedSlot, selectedCharacter };
}

function applyAction(action) {
  const state = readState();

  if (action.type === "start") {
    if (!state.running) {
      state.startedAt = Date.now();
      state.running = true;
    }
  }

  if (action.type === "pause") {
    if (state.running) {
      state.elapsedMs = nowElapsed(state);
      state.startedAt = null;
      state.running = false;
    }
  }

  if (action.type === "resetTimer") {
    state.elapsedMs = 0;
    state.startedAt = state.running ? Date.now() : null;
  }

  if (action.type === "setTitle") {
    state.title = String(action.title || "").trim().slice(0, 80);
  }

  if (action.type === "setIncludeDlc") {
    state.includeDlc = Boolean(action.includeDlc);
  }

  if (action.type === "setShowDeathCounter") {
    state.showDeathCounter = Boolean(action.showDeathCounter);
  }

  if (action.type === "setBossListMode") {
    state.bossListMode = BOSS_LIST_MODES.has(action.mode) ? action.mode : "allBosses";
  }

  if (action.type === "setPlatinumChecklistItem") {
    const id = String(action.id || "");
    if (MANUAL_PLATINUM_ITEM_IDS.has(id)) {
      state.platinumManual = normalizePlatinumManual(state.platinumManual);
      if (action.completed) {
        state.platinumManual[id] = true;
      } else {
        delete state.platinumManual[id];
      }
    }
  }

  if (action.type === "addCustomBoss") {
    const nextIds = normalizeBossIds([...(state.customBossIds || []), action.bossId], state.includeDlc !== false);
    state.customBossIds = nextIds;
  }

  if (action.type === "setCustomBoss") {
    const index = Number(action.index);
    if (Number.isInteger(index) && index >= 0 && Array.isArray(state.customBossIds) && state.customBossIds[index]) {
      const nextIds = [...state.customBossIds];
      nextIds[index] = String(action.bossId || "");
      state.customBossIds = normalizeBossIds(nextIds, state.includeDlc !== false);
    }
  }

  if (action.type === "removeCustomBoss") {
    const index = Number(action.index);
    if (Number.isInteger(index) && index >= 0 && Array.isArray(state.customBossIds)) {
      state.customBossIds.splice(index, 1);
    }
  }

  if (action.type === "removeCustomBossById") {
    const bossId = String(action.bossId || "");
    if (Array.isArray(state.customBossIds)) {
      state.customBossIds = state.customBossIds.filter(id => id !== bossId);
    }
  }

  if (action.type === "moveCustomBoss") {
    const index = Number(action.index);
    const direction = Number(action.direction);
    const target = index + (direction < 0 ? -1 : 1);
    if (
      Number.isInteger(index) &&
      target >= 0 &&
      Array.isArray(state.customBossIds) &&
      index >= 0 &&
      index < state.customBossIds.length &&
      target < state.customBossIds.length
    ) {
      const moved = state.customBossIds[index];
      state.customBossIds[index] = state.customBossIds[target];
      state.customBossIds[target] = moved;
    }
  }

  if (action.type === "nextSplit") {
    const i = state.bosses.findIndex(b => !b.killed);
    if (i >= 0) state.bosses[i].killed = true;
  }

  if (action.type === "toggleBoss") {
    const i = Number(action.index);
    if (state.bosses[i]) state.bosses[i].killed = !state.bosses[i].killed;
  }

  if (action.type === "incBossNow") {
    const i = Number(action.index);
    if (state.bosses[i]) state.bosses[i].now = (Number(state.bosses[i].now) || 0) + 1;
  }

  if (action.type === "decBossNow") {
    const i = Number(action.index);
    if (state.bosses[i]) state.bosses[i].now = Math.max(0, (Number(state.bosses[i].now) || 0) - 1);
  }

  if (action.type === "incTotalPB") {
    state.totalPB = (Number(state.totalPB) || 0) + 1;
  }

  if (action.type === "decTotalPB") {
    state.totalPB = Math.max(0, (Number(state.totalPB) || 0) - 1);
  }

  if (action.type === "toggleTask") {
    const i = Number(action.index);
    if (state.tasks[i]) state.tasks[i].done = !state.tasks[i].done;
  }

  if (action.type === "toggleRule") {
    const i = Number(action.index);
    if (state.rules[i]) state.rules[i].done = !state.rules[i].done;
  }

  if (action.type === "selectCharacterSlot") {
    const slot = Number(action.slot);
    state.selectedCharacterSlot = Number.isInteger(slot) && slot >= 0 && slot <= 9 ? slot : null;
  }

  if (action.type === "resetRun") {
    state.elapsedMs = 0;
    state.startedAt = null;
    state.running = false;
    state.bosses.forEach(b => {
      b.killed = false;
      b.now = 0;
    });
    state.tasks.forEach(t => t.done = false);
  }

  normalizeState(state);
  writeState(state);
  broadcastState();
  return state;
}

const clients = new Set();

function frame(data) {
  const payload = Buffer.from(data);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function broadcast(obj) {
  const msg = frame(JSON.stringify(obj));
  for (const socket of clients) {
    if (!socket.destroyed) socket.write(msg);
  }
}

function flattenBossCatalog() {
  return getBossCatalog().flatMap(region => (region.bosses || []).map(boss => ({
    id: boss.id,
    name: boss.name,
    place: boss.place || "",
    flagId: boss.flagId,
    regionName: region.regionName,
    dlc: region.dlc
  })));
}

function bossProgressMap(bossProgress) {
  const map = new Map();
  if (!bossProgress || !Array.isArray(bossProgress.regions)) return map;
  bossProgress.regions.forEach(region => {
    (region.bosses || []).forEach(boss => {
      map.set(boss.id, {
        ...boss,
        regionName: region.regionName,
        dlc: boss.dlc || region.dlc
      });
    });
  });
  return map;
}

function buildOrderedBossProgress(bossProgress, regionName, bossIds) {
  const byId = bossProgressMap(bossProgress);
  const bosses = bossIds.map(id => byId.get(id)).filter(Boolean);
  const killed = bosses.reduce((sum, boss) => sum + (boss.killed ? 1 : 0), 0);
  return {
    ...bossProgress,
    killed,
    total: bosses.length,
    regions: [
      {
        regionName,
        dlc: false,
        killed,
        total: bosses.length,
        bosses
      }
    ]
  };
}

function buildPlatinumChecklist(state, bossProgress) {
  const bossById = bossProgressMap(bossProgress);
  const manual = normalizePlatinumManual(state.platinumManual);
  const officialItems = BASE_PLATINUM_ITEMS.map(item => hydratePlatinumItem(item, bossById, manual));
  const officialCounted = officialItems.filter(item => item.countsForPlatinum !== false);
  const dlcItems = state.includeDlc === false
    ? []
    : flattenBossCatalog()
      .filter(boss => boss.dlc)
      .map(boss => hydrateDlcChecklistItem(boss, bossById));

  return {
    official: {
      id: "official",
      total: officialCounted.length,
      completed: officialCounted.reduce((sum, item) => sum + (item.completed ? 1 : 0), 0),
      items: officialItems
    },
    dlcOptional: {
      id: "dlcOptional",
      total: dlcItems.length,
      completed: dlcItems.reduce((sum, item) => sum + (item.completed ? 1 : 0), 0),
      items: dlcItems
    }
  };
}

function hydratePlatinumItem(item, bossById, manual) {
  const boss = item.bossId ? bossById.get(item.bossId) : null;
  const completed = item.source === "auto"
    ? Boolean(boss && boss.killed)
    : Boolean(manual[item.id]);
  return {
    ...item,
    completed,
    readonly: item.source === "auto",
    boss: boss ? serializeBossForChecklist(boss) : null
  };
}

function hydrateDlcChecklistItem(catalogBoss, bossById) {
  const boss = bossById.get(catalogBoss.id) || catalogBoss;
  return {
    id: `dlc-${String(catalogBoss.id).replace(/[^a-z0-9]+/gi, "-")}`,
    group: "dlcOptional",
    type: "dlcBoss",
    source: "auto",
    countsForPlatinum: false,
    bossId: catalogBoss.id,
    title: {
      en: catalogBoss.name,
      tr: catalogBoss.name
    },
    requirement: {
      en: `Defeat ${catalogBoss.name}.`,
      tr: `${catalogBoss.name} bossunu yen.`
    },
    completed: Boolean(boss && boss.killed),
    readonly: true,
    boss: serializeBossForChecklist(boss)
  };
}

function serializeBossForChecklist(boss) {
  return {
    id: boss.id,
    name: boss.name,
    place: boss.place || "",
    flagId: boss.flagId,
    regionName: boss.regionName || "",
    dlc: Boolean(boss.dlc)
  };
}

function applyBossListMode(bossProgress, state) {
  if (!bossProgress || !Array.isArray(bossProgress.regions)) return bossProgress;
  if (state.bossListMode === "allRemembrances") {
    return buildOrderedBossProgress(bossProgress, "All Remembrances", REMEMBRANCE_BOSS_IDS);
  }
  if (state.bossListMode === "customBosses") {
    return buildOrderedBossProgress(bossProgress, "Custom Bosses", state.customBossIds || []);
  }
  return bossProgress;
}

function filterBossProgress(bossProgress, includeDlc) {
  if (includeDlc !== false || !bossProgress || !Array.isArray(bossProgress.regions)) {
    return bossProgress;
  }

  const regions = bossProgress.regions
    .map(region => {
      const bosses = (region.bosses || []).filter(boss => !(boss.dlc || region.dlc));
      return {
        ...region,
        dlc: false,
        killed: bosses.reduce((sum, boss) => sum + (boss.killed ? 1 : 0), 0),
        total: bosses.length,
        bosses
      };
    })
    .filter(region => region.total > 0);
  return {
    ...bossProgress,
    killed: regions.reduce((sum, region) => sum + region.killed, 0),
    total: regions.reduce((sum, region) => sum + region.total, 0),
    regions
  };
}

function statePayload() {
  const state = normalizeState(readState());
  const saveStatus = getSaveStatus();
  const selected = resolveSelectedCharacter(state, saveStatus);
  const rawBossProgress = getBossProgress(selected.selectedCharacterSlot);
  const bossProgress = filterBossProgress(
    applyBossListMode(rawBossProgress, state),
    state.includeDlc
  );

  return {
    type: "state",
    state: {
      ...state,
      ...selected,
      bossProgress,
      platinumChecklist: buildPlatinumChecklist(state, rawBossProgress),
      bossCatalog: flattenBossCatalog(),
      liveElapsedMs: nowElapsed(state),
      saveStatus
    }
  };
}

function broadcastState() {
  broadcast(statePayload());
}

function parseWsMessage(buffer) {
  const second = buffer[1];
  const masked = (second & 0x80) !== 0;
  let len = second & 0x7f;
  let offset = 2;
  if (len === 126) {
    len = buffer.readUInt16BE(offset); offset += 2;
  } else if (len === 127) {
    len = Number(buffer.readBigUInt64BE(offset)); offset += 8;
  }
  let payload;
  if (masked) {
    const mask = buffer.slice(offset, offset + 4); offset += 4;
    payload = buffer.slice(offset, offset + len);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  } else {
    payload = buffer.slice(offset, offset + len);
  }
  return payload.toString("utf8");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/state") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(statePayload().state));
    return;
  }

  if (url.pathname === "/api/save-status") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(getSaveStatus()));
    return;
  }

  if (url.pathname === "/api/save-file" && req.method === "POST") {
    saveUploadedSaveFile(req, res);
    return;
  }

  if (url.pathname === "/api/action" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const action = JSON.parse(body || "{}");
        const state = applyAction(action);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, state }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
      }
    });
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/control.html";
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  if (req.headers.upgrade !== "websocket") return socket.destroy();

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  clients.add(socket);
  socket.write(frame(JSON.stringify(statePayload())));

  socket.on("data", (buffer) => {
    try {
      const msg = JSON.parse(parseWsMessage(buffer));
      if (msg && msg.type === "action") applyAction(msg.action || {});
    } catch (_) {}
  });

  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

setInterval(() => {
  const state = readState();
  if (state.running) broadcastState();
}, 1000);

startSaveWatcher(() => broadcastState());

server.listen(PORT, () => {
  console.log(`Elden Ring Challenge Overlay`);
  console.log(`Control: http://localhost:${PORT}/control.html`);
  console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`Save: ${getSaveStatus().path || "not configured"}`);
});
