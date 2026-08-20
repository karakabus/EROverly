const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile, spawn } = require("child_process");
const { getBossProgress, getBossCatalog, getSaveStatus, readLiveSavePath, startSaveWatcher } = require("./saveWatcher");
const { BASE_PLATINUM_ITEMS, MANUAL_PLATINUM_ITEM_IDS } = require("./platinumChecklist");
const { loadMapCatalog, writeMapManifest } = require("./eldenRingMapCatalog");
const {
  loadBossCatalog: loadBossAutomationCatalog,
  writeBossInspectManifest,
  writeBossManifest
} = require("./eldenRingBossCatalog");
const { loadRuneCatalog, writeRuneManifest } = require("./eldenRingRuneCatalog");
const { loadItemCatalog, searchItems, writeItemManifest } = require("./eldenRingItemCatalog");
const {
  loadCharacterCatalog,
  writeCharacterInspectManifest,
  writeCharacterManifest
} = require("./eldenRingCharacterCatalog");
const {
  loadInvincibilityCatalog,
  writeInvincibilityInspectManifest,
  writeInvincibilityManifest
} = require("./eldenRingInvincibilityCatalog");
const {
  HOTKEY_CODES,
  normalizeHotkeyMacros,
  readHotkeyConfig,
  writeHotkeyConfig,
  writeHotkeyManifest
} = require("./eldenRingHotkeyConfig");

const PORT = Number(process.env.PORT || 3210);
const ROOT = __dirname;
const STATE_PATH = path.join(ROOT, "state.json");
const RUNTIME_DIR = path.join(ROOT, ".runtime");
const RUNTIME_SAVE_CONFIG_PATH = path.join(RUNTIME_DIR, "save-path.json");
const MAX_SAVE_UPLOAD_BYTES = 128 * 1024 * 1024;
const BOSS_LIST_MODES = new Set(["allBosses", "allRemembrances", "customBosses", "platinumChecklist"]);
const MAP_HELPER_PATH = path.join(ROOT, "tools", "elden-ring-map-helper", "bin", "EldenRingMapHelper.exe");
const HOTKEY_HELPER_PATH = path.join(ROOT, "tools", "elden-ring-map-helper", "bin", "EldenRingHotkeyHelper.exe");
const HOTKEY_RUNTIME_DIR = path.join(RUNTIME_DIR, "hotkeys");
const HOTKEY_CONFIG_PATH = path.join(HOTKEY_RUNTIME_DIR, "config.json");
const CROSSOVER_WINE_PATH = process.env.CROSSOVER_WINE_PATH || "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine";
const CROSSOVER_BOTTLE = process.env.ER_CROSSOVER_BOTTLE || "Elden Ring";
const MAP_COMMAND_TIMEOUT_MS = 25000;
const MAP_AUTOMATIONS = new Set(["mainGameMaps", "dlcMaps", "mainGameGraces", "dlcGraces"]);
const cheatCommands = new Map();
const liveBossStateCache = new Map();
let hotkeyConfig = readHotkeyConfig(HOTKEY_CONFIG_PATH);
let hotkeyProcess = null;
let hotkeyLeaseTimer = null;
let hotkeyRuntimePaths = null;
let hotkeyRestartRequested = false;
let hotkeyRuntime = {
  state: "stopped",
  code: null,
  detail: null,
  pid: null,
  startedAt: null,
  stoppedAt: null,
  lastTriggeredAt: null,
  lastTriggeredMacroId: null,
  triggerCount: 0
};
let mapCatalog = null;
let mapCatalogError = null;
let runeCatalog = null;
let runeCatalogError = null;
let itemCatalog = null;
let itemCatalogError = null;
let bossAutomationCatalog = null;
let bossAutomationCatalogError = null;
let characterCatalog = null;
let characterCatalogError = null;
let invincibilityCatalog = null;
let invincibilityCatalogError = null;
try {
  mapCatalog = loadMapCatalog(ROOT);
} catch (error) {
  mapCatalogError = String(error.message || error);
}
try {
  runeCatalog = loadRuneCatalog(ROOT);
} catch (error) {
  runeCatalogError = String(error.message || error);
}
try {
  itemCatalog = loadItemCatalog(ROOT);
} catch (error) {
  itemCatalogError = String(error.message || error);
}
try {
  bossAutomationCatalog = loadBossAutomationCatalog(ROOT, getBossCatalog());
} catch (error) {
  bossAutomationCatalogError = String(error.message || error);
}
try {
  characterCatalog = loadCharacterCatalog(ROOT);
} catch (error) {
  characterCatalogError = String(error.message || error);
}
try {
  invincibilityCatalog = loadInvincibilityCatalog(ROOT);
} catch (error) {
  invincibilityCatalogError = String(error.message || error);
}
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

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(value));
}

function hotkeyAvailability() {
  if (!fs.existsSync(HOTKEY_HELPER_PATH)) return { ready: false, code: "HOTKEY_HELPER_NOT_BUILT" };
  if (!fs.existsSync(CROSSOVER_WINE_PATH)) return { ready: false, code: "CROSSOVER_NOT_FOUND" };
  return { ready: true, code: null };
}

function hotkeyPayload() {
  return {
    ok: true,
    available: hotkeyAvailability(),
    serviceEnabled: hotkeyConfig.serviceEnabled === true,
    service: { ...hotkeyRuntime },
    macros: hotkeyConfig.macros,
    supportedKeys: HOTKEY_CODES
  };
}

function removeHotkeyRuntimeFiles() {
  if (!hotkeyRuntimePaths) return;
  for (const filePath of [hotkeyRuntimePaths.lease, hotkeyRuntimePaths.manifest]) {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
    catch (_) {}
  }
  hotkeyRuntimePaths = null;
}

function clearHotkeyLeaseTimer() {
  if (hotkeyLeaseTimer) clearInterval(hotkeyLeaseTimer);
  hotkeyLeaseTimer = null;
}

function handleHotkeyHelperLine(line) {
  if (!line.startsWith("EROVERLY_HOTKEY_STATE\t")) return;
  const [, state, ...detailParts] = line.split("\t");
  if (state === "READY") {
    hotkeyRuntime.state = "running";
    hotkeyRuntime.code = null;
    hotkeyRuntime.detail = null;
    return;
  }
  if (state === "TRIGGERED") {
    hotkeyRuntime.lastTriggeredAt = Date.now();
    hotkeyRuntime.lastTriggeredMacroId = detailParts[0] || null;
    hotkeyRuntime.triggerCount += 1;
    return;
  }
  if (state === "ERROR") {
    hotkeyRuntime.state = "error";
    hotkeyRuntime.code = detailParts[0] || "HOTKEY_HELPER_FAILED";
    hotkeyRuntime.detail = detailParts.slice(1).join(" ").slice(0, 500) || null;
  }
}

function startHotkeyService() {
  if (hotkeyProcess || hotkeyRuntime.state === "starting") return;
  const availability = hotkeyAvailability();
  const enabledMacros = hotkeyConfig.macros.filter(macro => macro.enabled);
  if (!availability.ready || !enabledMacros.length) {
    hotkeyRuntime.state = "error";
    hotkeyRuntime.code = availability.code || "NO_ENABLED_HOTKEY_MACROS";
    hotkeyRuntime.detail = null;
    return;
  }

  const runtimeId = crypto.randomUUID();
  const paths = {
    manifest: path.join(HOTKEY_RUNTIME_DIR, `${runtimeId}.tsv`),
    lease: path.join(HOTKEY_RUNTIME_DIR, `${runtimeId}.lease`)
  };
  try {
    writeHotkeyManifest(paths.manifest, hotkeyConfig.macros);
    fs.writeFileSync(paths.lease, String(Date.now()), "utf8");
  } catch (error) {
    hotkeyRuntime.state = "error";
    hotkeyRuntime.code = "HOTKEY_CONFIG_FAILED";
    hotkeyRuntime.detail = String(error.message || error).slice(0, 500);
    return;
  }

  hotkeyRuntimePaths = paths;
  hotkeyRuntime = {
    ...hotkeyRuntime,
    state: "starting",
    code: null,
    detail: null,
    pid: null,
    startedAt: Date.now(),
    stoppedAt: null
  };
  const child = spawn(
    CROSSOVER_WINE_PATH,
    ["--bottle", CROSSOVER_BOTTLE, HOTKEY_HELPER_PATH, "--watch", toWinePath(paths.manifest), toWinePath(paths.lease)],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  hotkeyProcess = child;
  hotkeyRuntime.pid = child.pid || null;
  let stdoutBuffer = "";
  let stderrBuffer = "";
  child.stdout.on("data", chunk => {
    stdoutBuffer += String(chunk);
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) handleHotkeyHelperLine(line);
  });
  child.stderr.on("data", chunk => {
    stderrBuffer = `${stderrBuffer}${String(chunk)}`.slice(-2000);
  });
  child.on("error", error => {
    hotkeyRuntime.state = "error";
    hotkeyRuntime.code = "HOTKEY_HELPER_START_FAILED";
    hotkeyRuntime.detail = String(error.message || error).slice(0, 500);
  });
  child.on("exit", (exitCode, signal) => {
    if (stdoutBuffer) handleHotkeyHelperLine(stdoutBuffer);
    const restart = hotkeyRestartRequested && hotkeyConfig.serviceEnabled;
    hotkeyRestartRequested = false;
    const wasStopping = hotkeyRuntime.state === "stopping";
    hotkeyProcess = null;
    clearHotkeyLeaseTimer();
    removeHotkeyRuntimeFiles();
    hotkeyRuntime.pid = null;
    hotkeyRuntime.stoppedAt = Date.now();
    if (restart) {
      hotkeyRuntime.state = "stopped";
      setTimeout(startHotkeyService, 100);
      return;
    }
    if (!hotkeyConfig.serviceEnabled || wasStopping) {
      hotkeyRuntime.state = "stopped";
      hotkeyRuntime.code = null;
      hotkeyRuntime.detail = null;
      return;
    }
    if (hotkeyRuntime.state !== "error") {
      hotkeyRuntime.state = "error";
      hotkeyRuntime.code = "HOTKEY_HELPER_EXITED";
      hotkeyRuntime.detail = `${exitCode ?? ""}${signal ? ` ${signal}` : ""}${stderrBuffer ? ` ${stderrBuffer.trim()}` : ""}`.trim().slice(0, 500) || null;
    }
  });

  hotkeyLeaseTimer = setInterval(() => {
    try {
      if (hotkeyRuntimePaths?.lease) {
        const now = new Date();
        fs.utimesSync(hotkeyRuntimePaths.lease, now, now);
      }
    } catch (error) {
      hotkeyRuntime.state = "error";
      hotkeyRuntime.code = "HOTKEY_LEASE_FAILED";
      hotkeyRuntime.detail = String(error.message || error).slice(0, 500);
      clearHotkeyLeaseTimer();
      if (hotkeyRuntimePaths?.lease) {
        try { fs.unlinkSync(hotkeyRuntimePaths.lease); }
        catch (_) {}
      }
    }
  }, 1000);
}

function stopHotkeyService(restart) {
  hotkeyRestartRequested = restart === true;
  clearHotkeyLeaseTimer();
  if (hotkeyRuntimePaths?.lease) {
    try { fs.unlinkSync(hotkeyRuntimePaths.lease); }
    catch (_) {}
  }
  if (hotkeyProcess) {
    hotkeyRuntime.state = "stopping";
    return;
  }
  removeHotkeyRuntimeFiles();
  hotkeyRuntime.state = "stopped";
  hotkeyRuntime.pid = null;
  hotkeyRuntime.stoppedAt = Date.now();
  if (hotkeyRestartRequested && hotkeyConfig.serviceEnabled) {
    hotkeyRestartRequested = false;
    startHotkeyService();
  }
}

function readHotkeyConfigRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 64 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      const macros = normalizeHotkeyMacros(payload.macros);
      const hasEnabled = macros.some(macro => macro.enabled);
      const wasRunning = Boolean(hotkeyProcess);
      hotkeyConfig = writeHotkeyConfig(HOTKEY_CONFIG_PATH, {
        serviceEnabled: hotkeyConfig.serviceEnabled && hasEnabled,
        macros
      });
      if (wasRunning) stopHotkeyService(hotkeyConfig.serviceEnabled);
      else if (hotkeyConfig.serviceEnabled) startHotkeyService();
      sendJson(res, 200, hotkeyPayload());
    } catch (error) {
      const message = String(error.message || error);
      sendJson(res, 400, { ok: false, code: message.startsWith("HOTKEY_") || message.startsWith("INVALID_HOTKEY_") ? message : "INVALID_HOTKEY_CONFIG" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function readHotkeyServiceRequest(req, res) {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      if (typeof payload.enabled !== "boolean") {
        sendJson(res, 400, { ok: false, code: "INVALID_HOTKEY_SERVICE_STATE" });
        return;
      }
      if (payload.enabled && !hotkeyConfig.macros.some(macro => macro.enabled)) {
        sendJson(res, 400, { ok: false, code: "NO_ENABLED_HOTKEY_MACROS" });
        return;
      }
      const availability = hotkeyAvailability();
      if (payload.enabled && !availability.ready) {
        sendJson(res, 503, { ok: false, code: availability.code });
        return;
      }
      hotkeyConfig = writeHotkeyConfig(HOTKEY_CONFIG_PATH, {
        serviceEnabled: payload.enabled,
        macros: hotkeyConfig.macros
      });
      if (payload.enabled) startHotkeyService();
      else stopHotkeyService(false);
      sendJson(res, 200, hotkeyPayload());
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function cleanupCheatCommands() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, command] of cheatCommands) {
    if (command.createdAt < cutoff) cheatCommands.delete(id);
  }
}

function serializeCheatCommand(command) {
  return {
    id: command.id,
    state: command.state,
    actions: command.actions,
    errorCode: command.errorCode || null,
    resultCode: command.resultCode || null,
    detail: command.detail || null,
    amount: command.amount || null,
    quantity: command.quantity || null,
    bossChanges: command.bossChanges || null,
    characterStats: command.characterStats || null,
    invincibility: command.invincibility || null,
    item: command.item
      ? {
          key: command.item.key,
          category: command.item.category,
          baseId: command.item.baseId,
          name: command.item.name
        }
      : null,
    backupRequested: command.backupRequested === true,
    backup: command.backup || null,
    createdAt: command.createdAt,
    startedAt: command.startedAt || null,
    finishedAt: command.finishedAt || null
  };
}

function mapHelperStatus() {
  let code = null;
  if (!fs.existsSync(MAP_HELPER_PATH)) code = "HELPER_NOT_BUILT";
  else if (!fs.existsSync(CROSSOVER_WINE_PATH)) code = "CROSSOVER_NOT_FOUND";
  return {
    ok: true,
    connected: !code,
    mode: "direct-memory",
    code,
    tableName: mapCatalog?.tableName || null,
    tableVersion: mapCatalog?.tableVersion || null,
    tablePath: mapCatalog?.tablePath || null,
    actions: mapCatalog
      ? Object.fromEntries(Object.entries(mapCatalog.actions).map(([action, operations]) => [action, operations.length]))
      : {},
    features: {
      maps: { ready: !mapCatalogError, code: mapCatalogError ? "CT_MAP_CATALOG_INVALID" : null },
      runes: {
        ready: !runeCatalogError,
        code: runeCatalogError ? "CT_RUNE_CATALOG_INVALID" : null,
        sourceRecordId: runeCatalog?.sourceRecordId || null,
        maxRunes: runeCatalog?.maxRunes || null
      },
      items: {
        ready: !itemCatalogError,
        code: itemCatalogError ? "CT_ITEM_CATALOG_INVALID" : null,
        sourceRecordIds: itemCatalog?.sourceRecordIds || [],
        count: itemCatalog?.items.length || 0,
        maxQuantity: itemCatalog?.maxQuantity || null
      },
      bosses: {
        ready: !bossAutomationCatalogError,
        code: bossAutomationCatalogError ? "CT_BOSS_CATALOG_INVALID" : null,
        sourceGroupIds: [1337304929, 1337314897],
        count: bossAutomationCatalog?.bosses.length || 0,
        matchedSourceCount: bossAutomationCatalog?.matchedSourceCount || 0
      },
      characterStats: {
        ready: !characterCatalogError,
        code: characterCatalogError ? "CT_CHARACTER_CATALOG_INVALID" : null,
        sourceGroupId: characterCatalog?.sourceGroupId || null,
        count: characterCatalog?.fields.length || 0
      },
      invincibility: {
        ready: !invincibilityCatalogError,
        code: invincibilityCatalogError ? "CT_INVINCIBILITY_CATALOG_INVALID" : null,
        sourceRecordIds: invincibilityCatalog?.fields.map(field => field.sourceRecordId) || [],
        count: invincibilityCatalog?.fields.length || 0
      },
      hotkeys: {
        ready: fs.existsSync(HOTKEY_HELPER_PATH),
        code: fs.existsSync(HOTKEY_HELPER_PATH) ? null : "HOTKEY_HELPER_NOT_BUILT"
      }
    },
    detail: mapCatalogError || runeCatalogError || itemCatalogError || bossAutomationCatalogError || characterCatalogError || invincibilityCatalogError
  };
}

function toWinePath(filePath) {
  return `Z:${path.resolve(filePath).replaceAll("/", "\\")}`;
}

function parseMapHelperOutput(stdout) {
  const line = String(stdout || "")
    .split(/\r?\n/)
    .find(value => value.startsWith("EROVERLY_RESULT\t"));
  if (!line) return null;
  const [, state, code, ...detail] = line.split("\t");
  return { state, code, detail: detail.join(" ").slice(0, 500) };
}

function createPreCommandSaveBackup(command) {
  const savePath = readLiveSavePath();
  if (!savePath || !fs.existsSync(savePath)) {
    throw new Error("SAVE_BACKUP_NOT_CONFIGURED");
  }

  const before = fs.statSync(savePath);
  if (!before.isFile() || before.size <= 0) throw new Error("SAVE_BACKUP_SOURCE_INVALID");
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const extension = path.extname(savePath).toLowerCase();
  const includesMaps = command.actions.some(action => action.endsWith("Maps"));
  const includesGraces = command.actions.some(action => action.endsWith("Graces"));
  const commandLabel = command.actions.includes("addRunes")
    ? "runes"
    : command.actions.includes("addItem")
      ? "item"
      : command.actions.includes("updateBosses")
        ? "bosses"
        : command.actions.includes("updateCharacterStats")
          ? "character-stats"
          : includesMaps && includesGraces
            ? "maps-graces"
            : includesGraces
              ? "graces"
              : "maps";
  const backupPath = path.join(
    RUNTIME_DIR,
    "save-backups",
    `${path.basename(savePath, extension)}.pre-${commandLabel}-${timestamp}-${command.id.slice(0, 8)}${extension}`
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(savePath, backupPath, fs.constants.COPYFILE_EXCL);

  const after = fs.statSync(savePath);
  const backup = fs.statSync(backupPath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || backup.size !== before.size) {
    fs.unlinkSync(backupPath);
    throw new Error("SAVE_CHANGED_DURING_BACKUP");
  }

  const sourceHash = crypto.createHash("sha256").update(fs.readFileSync(savePath)).digest("hex");
  const backupHash = crypto.createHash("sha256").update(fs.readFileSync(backupPath)).digest("hex");
  if (sourceHash !== backupHash) {
    fs.unlinkSync(backupPath);
    throw new Error("SAVE_BACKUP_HASH_MISMATCH");
  }

  command.backup = {
    path: backupPath,
    size: backup.size,
    sha256: backupHash
  };
}

function bossListWithStates(states, source, readable, warning) {
  return {
    ok: true,
    readable,
    source,
    warning: warning || null,
    updatedAt: Date.now(),
    bosses: (bossAutomationCatalog?.bosses || []).map(boss => ({
      id: boss.id,
      name: boss.name,
      place: boss.place,
      regionName: boss.regionName,
      dlc: boss.dlc,
      dead: states.has(boss.id) ? states.get(boss.id) : null,
      writable: boss.writable,
      sourceRecordId: boss.sourceRecordId,
      recursiveFlagCount: boss.operations.length
    }))
  };
}

function saveBossStateFallback(warning) {
  const appState = readState();
  const selected = resolveSelectedCharacter(appState, getSaveStatus());
  const progress = getBossProgress(selected.selectedCharacterSlot);
  const states = new Map();
  if (progress.readable) {
    for (const region of progress.regions || []) {
      for (const boss of region.bosses || []) states.set(boss.id, Boolean(boss.killed));
    }
  }
  return bossListWithStates(states, "save-fallback", Boolean(progress.readable), warning || progress.error);
}

function parseBossInspectionOutput(stdout) {
  const states = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.startsWith("EROVERLY_BOSS_STATE\t")) continue;
    const [, id, value] = line.split("\t");
    if (id && (value === "0" || value === "1")) states.set(id, value === "1");
  }
  return states;
}

function sendBossInspection(res) {
  if (bossAutomationCatalogError || !bossAutomationCatalog) {
    sendJson(res, 503, { ok: false, code: "CT_BOSS_CATALOG_INVALID", detail: bossAutomationCatalogError });
    return;
  }
  const helperStatus = mapHelperStatus();
  if (!helperStatus.connected || !helperStatus.features.bosses.ready) {
    sendJson(res, 200, saveBossStateFallback(helperStatus.code || helperStatus.features.bosses.code));
    return;
  }
  if ([...cheatCommands.values()].some(command => command.state === "running")) {
    sendJson(res, 200, saveBossStateFallback("COMMAND_BUSY"));
    return;
  }

  const inspectionId = crypto.randomUUID();
  const manifestPath = path.join(RUNTIME_DIR, "cheat-commands", `${inspectionId}.tsv`);
  try {
    writeBossInspectManifest(bossAutomationCatalog, manifestPath);
  } catch (error) {
    sendJson(res, 503, { ok: false, code: "MANIFEST_FAILED", detail: String(error.message || error).slice(0, 500) });
    return;
  }

  execFile(
    CROSSOVER_WINE_PATH,
    ["--bottle", CROSSOVER_BOTTLE, MAP_HELPER_PATH, "--inspect", toWinePath(manifestPath)],
    { timeout: MAP_COMMAND_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
    (error, stdout, stderr) => {
      fs.unlink(manifestPath, () => {});
      const result = parseMapHelperOutput(stdout);
      const states = parseBossInspectionOutput(stdout);
      if (result?.state === "OK" && states.size === bossAutomationCatalog.bosses.filter(boss => boss.writable).length) {
        liveBossStateCache.clear();
        for (const [id, dead] of states) liveBossStateCache.set(id, dead);
        sendJson(res, 200, bossListWithStates(states, "live-memory", true, null));
        return;
      }
      const warning = result?.code || (error?.killed ? "HELPER_TIMEOUT" : "HELPER_START_FAILED");
      const fallback = saveBossStateFallback(warning);
      if (!fallback.readable && stderr) fallback.detail = String(stderr).slice(0, 500);
      sendJson(res, 200, fallback);
    }
  );
}

function readBossAutomationRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 64 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      if (bossAutomationCatalogError || !bossAutomationCatalog) {
        sendJson(res, 503, { ok: false, code: "CT_BOSS_CATALOG_INVALID", detail: bossAutomationCatalogError });
        return;
      }
      const known = new Map(bossAutomationCatalog.bosses.map(boss => [boss.id, boss]));
      const changes = Array.isArray(payload.changes) ? payload.changes : [];
      const normalized = [];
      const seen = new Set();
      for (const change of changes) {
        const id = typeof change?.id === "string" ? change.id : "";
        const targetState = change?.state;
        const boss = known.get(id);
        if (!boss || !boss.writable || seen.has(id) || (targetState !== "alive" && targetState !== "dead")) {
          sendJson(res, 400, { ok: false, code: "INVALID_BOSS_CHANGE" });
          return;
        }
        seen.add(id);
        normalized.push({ id, state: targetState });
      }
      if (!normalized.length || normalized.length > bossAutomationCatalog.bosses.length) {
        sendJson(res, 400, { ok: false, code: "NO_BOSS_CHANGES" });
        return;
      }

      const helperStatus = mapHelperStatus();
      if (!helperStatus.connected) {
        sendJson(res, 503, { ok: false, code: helperStatus.code, detail: helperStatus.detail });
        return;
      }
      if (!helperStatus.features.bosses.ready) {
        sendJson(res, 503, { ok: false, code: helperStatus.features.bosses.code, detail: bossAutomationCatalogError });
        return;
      }
      if ([...cheatCommands.values()].some(command => command.state === "running")) {
        sendJson(res, 409, { ok: false, code: "COMMAND_BUSY" });
        return;
      }

      cleanupCheatCommands();
      const command = {
        id: crypto.randomUUID(),
        state: "created",
        actions: ["updateBosses"],
        bossChanges: normalized,
        bossPreviousStates: Object.fromEntries(normalized.map(change => [
          change.id,
          liveBossStateCache.has(change.id) ? liveBossStateCache.get(change.id) : null
        ])),
        backupRequested: payload.backup === true,
        createdAt: Date.now()
      };
      cheatCommands.set(command.id, command);
      runDirectCommand(command, manifestPath => writeBossManifest(bossAutomationCatalog, normalized, manifestPath));
      sendJson(res, 202, { ok: true, command: serializeCheatCommand(command) });
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function characterStatsPayload(values, readable, warning) {
  return {
    ok: true,
    readable,
    source: readable ? "live-memory" : null,
    warning: warning || null,
    updatedAt: Date.now(),
    fields: (characterCatalog?.fields || []).map(field => ({
      key: field.key,
      name: field.name,
      min: field.min,
      max: field.max,
      sourceRecordId: field.sourceRecordId,
      value: values.has(field.key) ? values.get(field.key) : null
    }))
  };
}

function parseCharacterInspectionOutput(stdout) {
  const values = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.startsWith("EROVERLY_CHARACTER_STAT\t")) continue;
    const [, key, rawValue] = line.split("\t");
    const value = Number(rawValue);
    if (key && Number.isSafeInteger(value)) values.set(key, value);
  }
  return values;
}

function sendCharacterStatsInspection(res) {
  if (characterCatalogError || !characterCatalog) {
    sendJson(res, 503, { ok: false, code: "CT_CHARACTER_CATALOG_INVALID", detail: characterCatalogError });
    return;
  }
  const helperStatus = mapHelperStatus();
  if (!helperStatus.connected || !helperStatus.features.characterStats.ready) {
    sendJson(res, 200, characterStatsPayload(new Map(), false, helperStatus.code || helperStatus.features.characterStats.code));
    return;
  }
  if ([...cheatCommands.values()].some(command => command.state === "running")) {
    sendJson(res, 200, characterStatsPayload(new Map(), false, "COMMAND_BUSY"));
    return;
  }

  const inspectionId = crypto.randomUUID();
  const manifestPath = path.join(RUNTIME_DIR, "cheat-commands", `${inspectionId}.tsv`);
  try {
    writeCharacterInspectManifest(characterCatalog, manifestPath);
  } catch (error) {
    sendJson(res, 503, { ok: false, code: "MANIFEST_FAILED", detail: String(error.message || error).slice(0, 500) });
    return;
  }

  execFile(
    CROSSOVER_WINE_PATH,
    ["--bottle", CROSSOVER_BOTTLE, MAP_HELPER_PATH, "--inspect", toWinePath(manifestPath)],
    { timeout: MAP_COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      fs.unlink(manifestPath, () => {});
      const result = parseMapHelperOutput(stdout);
      const values = parseCharacterInspectionOutput(stdout);
      if (result?.state === "OK" && values.size === characterCatalog.fields.length) {
        sendJson(res, 200, characterStatsPayload(values, true, null));
        return;
      }
      const warning = result?.code || (error?.killed ? "HELPER_TIMEOUT" : "HELPER_START_FAILED");
      const payload = characterStatsPayload(new Map(), false, warning);
      if (stderr) payload.detail = String(stderr).slice(0, 500);
      sendJson(res, 200, payload);
    }
  );
}

function readCharacterStatsAutomationRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      if (characterCatalogError || !characterCatalog) {
        sendJson(res, 503, { ok: false, code: "CT_CHARACTER_CATALOG_INVALID", detail: characterCatalogError });
        return;
      }
      if (!payload.values || typeof payload.values !== "object" || Array.isArray(payload.values)) {
        sendJson(res, 400, { ok: false, code: "NO_CHARACTER_STAT_CHANGES" });
        return;
      }
      const normalized = {};
      for (const [key, rawValue] of Object.entries(payload.values)) {
        const field = characterCatalog.byKey.get(key);
        const value = Number(rawValue);
        if (!field || !Number.isSafeInteger(value) || value < field.min || value > field.max) {
          sendJson(res, 400, { ok: false, code: "INVALID_CHARACTER_STAT", field: key });
          return;
        }
        normalized[key] = value;
      }
      if (!Object.keys(normalized).length || Object.keys(normalized).length > characterCatalog.fields.length) {
        sendJson(res, 400, { ok: false, code: "NO_CHARACTER_STAT_CHANGES" });
        return;
      }

      const helperStatus = mapHelperStatus();
      if (!helperStatus.connected) {
        sendJson(res, 503, { ok: false, code: helperStatus.code, detail: helperStatus.detail });
        return;
      }
      if (!helperStatus.features.characterStats.ready) {
        sendJson(res, 503, { ok: false, code: helperStatus.features.characterStats.code, detail: characterCatalogError });
        return;
      }
      if ([...cheatCommands.values()].some(command => command.state === "running")) {
        sendJson(res, 409, { ok: false, code: "COMMAND_BUSY" });
        return;
      }

      cleanupCheatCommands();
      const command = {
        id: crypto.randomUUID(),
        state: "created",
        actions: ["updateCharacterStats"],
        characterStats: normalized,
        backupRequested: payload.backup === true,
        createdAt: Date.now()
      };
      cheatCommands.set(command.id, command);
      runDirectCommand(command, manifestPath => writeCharacterManifest(characterCatalog, normalized, manifestPath));
      sendJson(res, 202, { ok: true, command: serializeCheatCommand(command) });
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function invincibilityPayload(values, readable, warning) {
  return {
    ok: true,
    readable,
    source: readable ? "live-memory" : null,
    warning: warning || null,
    updatedAt: Date.now(),
    fields: (invincibilityCatalog?.fields || []).map(field => ({
      key: field.key,
      sourceRecordId: field.sourceRecordId,
      enabled: values.has(field.key) ? values.get(field.key) : null
    }))
  };
}

function parseInvincibilityInspectionOutput(stdout) {
  const values = new Map();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.startsWith("EROVERLY_INVINCIBILITY_STATE\t")) continue;
    const [, key, rawValue] = line.split("\t");
    if (key && (rawValue === "0" || rawValue === "1")) values.set(key, rawValue === "1");
  }
  return values;
}

function sendInvincibilityInspection(res) {
  if (invincibilityCatalogError || !invincibilityCatalog) {
    sendJson(res, 503, { ok: false, code: "CT_INVINCIBILITY_CATALOG_INVALID", detail: invincibilityCatalogError });
    return;
  }
  const helperStatus = mapHelperStatus();
  if (!helperStatus.connected || !helperStatus.features.invincibility.ready) {
    sendJson(res, 200, invincibilityPayload(new Map(), false, helperStatus.code || helperStatus.features.invincibility.code));
    return;
  }
  if ([...cheatCommands.values()].some(command => command.state === "running")) {
    sendJson(res, 200, invincibilityPayload(new Map(), false, "COMMAND_BUSY"));
    return;
  }

  const inspectionId = crypto.randomUUID();
  const manifestPath = path.join(RUNTIME_DIR, "cheat-commands", `${inspectionId}.tsv`);
  try {
    writeInvincibilityInspectManifest(invincibilityCatalog, manifestPath);
  } catch (error) {
    sendJson(res, 503, { ok: false, code: "MANIFEST_FAILED", detail: String(error.message || error).slice(0, 500) });
    return;
  }

  execFile(
    CROSSOVER_WINE_PATH,
    ["--bottle", CROSSOVER_BOTTLE, MAP_HELPER_PATH, "--inspect", toWinePath(manifestPath)],
    { timeout: MAP_COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      fs.unlink(manifestPath, () => {});
      const result = parseMapHelperOutput(stdout);
      const values = parseInvincibilityInspectionOutput(stdout);
      if (result?.state === "OK" && values.size === invincibilityCatalog.fields.length) {
        sendJson(res, 200, invincibilityPayload(values, true, null));
        return;
      }
      const warning = result?.code || (error?.killed ? "HELPER_TIMEOUT" : "HELPER_START_FAILED");
      const payload = invincibilityPayload(new Map(), false, warning);
      if (stderr) payload.detail = String(stderr).slice(0, 500);
      sendJson(res, 200, payload);
    }
  );
}

function readInvincibilityAutomationRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 4 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      if (invincibilityCatalogError || !invincibilityCatalog) {
        sendJson(res, 503, { ok: false, code: "CT_INVINCIBILITY_CATALOG_INVALID", detail: invincibilityCatalogError });
        return;
      }
      if (!payload.values || typeof payload.values !== "object" || Array.isArray(payload.values)) {
        sendJson(res, 400, { ok: false, code: "NO_INVINCIBILITY_CHANGES" });
        return;
      }
      const normalized = {};
      for (const [key, value] of Object.entries(payload.values)) {
        if (!invincibilityCatalog.byKey.has(key) || typeof value !== "boolean") {
          sendJson(res, 400, { ok: false, code: "INVALID_INVINCIBILITY_STATE", field: key });
          return;
        }
        normalized[key] = value;
      }
      if (!Object.keys(normalized).length || Object.keys(normalized).length > invincibilityCatalog.fields.length) {
        sendJson(res, 400, { ok: false, code: "NO_INVINCIBILITY_CHANGES" });
        return;
      }

      const helperStatus = mapHelperStatus();
      if (!helperStatus.connected) {
        sendJson(res, 503, { ok: false, code: helperStatus.code, detail: helperStatus.detail });
        return;
      }
      if (!helperStatus.features.invincibility.ready) {
        sendJson(res, 503, { ok: false, code: helperStatus.features.invincibility.code, detail: invincibilityCatalogError });
        return;
      }
      if ([...cheatCommands.values()].some(command => command.state === "running")) {
        sendJson(res, 409, { ok: false, code: "COMMAND_BUSY" });
        return;
      }

      cleanupCheatCommands();
      const command = {
        id: crypto.randomUUID(),
        state: "created",
        actions: ["updateInvincibility"],
        invincibility: normalized,
        backupRequested: false,
        createdAt: Date.now()
      };
      cheatCommands.set(command.id, command);
      runDirectCommand(command, manifestPath => writeInvincibilityManifest(invincibilityCatalog, normalized, manifestPath));
      sendJson(res, 202, { ok: true, command: serializeCheatCommand(command) });
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function runDirectCommand(command, writeManifest) {
  const manifestPath = path.join(RUNTIME_DIR, "cheat-commands", `${command.id}.tsv`);
  try {
    if (command.backupRequested) createPreCommandSaveBackup(command);
    writeManifest(manifestPath);
  } catch (error) {
    command.state = "failed";
    command.errorCode = String(error.message || error).startsWith("SAVE_") ? String(error.message || error) : "MANIFEST_FAILED";
    command.detail = String(error.message || error).slice(0, 500);
    command.finishedAt = Date.now();
    return;
  }

  command.state = "running";
  command.startedAt = Date.now();
  execFile(
    CROSSOVER_WINE_PATH,
    ["--bottle", CROSSOVER_BOTTLE, MAP_HELPER_PATH, "--apply", toWinePath(manifestPath)],
    { timeout: MAP_COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      fs.unlink(manifestPath, () => {});
      const result = parseMapHelperOutput(stdout);
      command.finishedAt = Date.now();

      if (result?.state === "OK") {
        command.state = "succeeded";
        command.resultCode = result.code;
        command.detail = result.detail;
        if (command.actions.includes("updateBosses")) publishBossStateChanges(command);
        return;
      }

      command.state = "failed";
      command.errorCode = result?.code || (error?.killed ? "HELPER_TIMEOUT" : "HELPER_START_FAILED");
      command.detail = (result?.detail || String(stderr || error?.message || "Unknown helper failure")).slice(0, 500);
    }
  );
}

function publishBossStateChanges(command) {
  for (const change of command.bossChanges || []) {
    const boss = bossAutomationCatalog?.bosses.find(item => item.id === change.id);
    if (!boss) continue;
    const previous = command.bossPreviousStates?.[change.id];
    const dead = change.state === "dead";
    liveBossStateCache.set(change.id, dead);
    broadcast({
      type: "boss-state-changed",
      bossId: boss.id,
      regionName: boss.regionName,
      dlc: boss.dlc,
      dead,
      newlyKilled: dead && previous !== true,
      changedAt: Date.now()
    });
  }
}

function readCheatAutomationRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      const actions = Array.isArray(payload.actions)
        ? [...new Set(payload.actions.filter(action => typeof action === "string"))]
        : [];
      if (!actions.length) {
        sendJson(res, 400, { ok: false, code: "NO_ACTIONS" });
        return;
      }
      if (actions.some(action => !MAP_AUTOMATIONS.has(action))) {
        sendJson(res, 400, { ok: false, code: "UNKNOWN_ACTION" });
        return;
      }
      const helperStatus = mapHelperStatus();
      if (!helperStatus.connected) {
        sendJson(res, 503, { ok: false, code: helperStatus.code, detail: helperStatus.detail });
        return;
      }
      if (!helperStatus.features.maps.ready) {
        sendJson(res, 503, { ok: false, code: helperStatus.features.maps.code, detail: mapCatalogError });
        return;
      }
      if ([...cheatCommands.values()].some(command => command.state === "running")) {
        sendJson(res, 409, { ok: false, code: "COMMAND_BUSY" });
        return;
      }

      cleanupCheatCommands();
      const command = {
        id: crypto.randomUUID(),
        state: "created",
        actions,
        backupRequested: payload.backup === true,
        createdAt: Date.now()
      };
      cheatCommands.set(command.id, command);
      runDirectCommand(command, manifestPath => writeMapManifest(mapCatalog, command.actions, manifestPath));
      sendJson(res, 202, { ok: true, command: serializeCheatCommand(command) });
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function readRuneAutomationRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      const amount = Number(payload.amount);
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > (runeCatalog?.maxRunes || 0)) {
        sendJson(res, 400, { ok: false, code: "INVALID_RUNE_AMOUNT" });
        return;
      }

      const helperStatus = mapHelperStatus();
      if (!helperStatus.connected) {
        sendJson(res, 503, { ok: false, code: helperStatus.code, detail: helperStatus.detail });
        return;
      }
      if (!helperStatus.features.runes.ready) {
        sendJson(res, 503, { ok: false, code: helperStatus.features.runes.code, detail: runeCatalogError });
        return;
      }
      if ([...cheatCommands.values()].some(command => command.state === "running")) {
        sendJson(res, 409, { ok: false, code: "COMMAND_BUSY" });
        return;
      }

      cleanupCheatCommands();
      const command = {
        id: crypto.randomUUID(),
        state: "created",
        actions: ["addRunes"],
        amount,
        backupRequested: payload.backup === true,
        createdAt: Date.now()
      };
      cheatCommands.set(command.id, command);
      runDirectCommand(command, manifestPath => writeRuneManifest(runeCatalog, amount, manifestPath));
      sendJson(res, 202, { ok: true, command: serializeCheatCommand(command) });
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
}

function sendItemLookup(url, res) {
  if (itemCatalogError || !itemCatalog) {
    sendJson(res, 503, { ok: false, code: "CT_ITEM_CATALOG_INVALID", detail: itemCatalogError });
    return;
  }
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  const results = searchItems(itemCatalog, query, 25).map(item => ({
    key: item.key,
    category: item.category,
    baseId: item.baseId,
    name: item.name
  }));
  sendJson(res, 200, { ok: true, query, results });
}

function readItemAutomationRequest(req, res) {
  let body = "";
  let rejected = false;
  req.on("data", chunk => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
      rejected = true;
      sendJson(res, 413, { ok: false, code: "REQUEST_TOO_LARGE" });
    }
  });
  req.on("end", () => {
    if (rejected) return;
    try {
      const payload = JSON.parse(body || "{}");
      if (itemCatalogError || !itemCatalog) {
        sendJson(res, 503, { ok: false, code: "CT_ITEM_CATALOG_INVALID", detail: itemCatalogError });
        return;
      }
      const itemKey = typeof payload.itemKey === "string" ? payload.itemKey : "";
      const item = itemCatalog.byKey.get(itemKey);
      const quantity = Number(payload.quantity);
      if (!item) {
        sendJson(res, 400, { ok: false, code: "UNKNOWN_ITEM" });
        return;
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > (itemCatalog?.maxQuantity || 0)) {
        sendJson(res, 400, { ok: false, code: "INVALID_ITEM_QUANTITY" });
        return;
      }

      const helperStatus = mapHelperStatus();
      if (!helperStatus.connected) {
        sendJson(res, 503, { ok: false, code: helperStatus.code, detail: helperStatus.detail });
        return;
      }
      if (!helperStatus.features.items.ready) {
        sendJson(res, 503, { ok: false, code: helperStatus.features.items.code, detail: itemCatalogError });
        return;
      }
      if ([...cheatCommands.values()].some(command => command.state === "running")) {
        sendJson(res, 409, { ok: false, code: "COMMAND_BUSY" });
        return;
      }

      cleanupCheatCommands();
      const command = {
        id: crypto.randomUUID(),
        state: "created",
        actions: ["addItem"],
        item,
        quantity,
        backupRequested: payload.backup === true,
        createdAt: Date.now()
      };
      cheatCommands.set(command.id, command);
      runDirectCommand(command, manifestPath => writeItemManifest(itemCatalog, item, quantity, manifestPath));
      sendJson(res, 202, { ok: true, command: serializeCheatCommand(command) });
    } catch (_) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON" });
    }
  });
  req.on("error", () => {
    if (!res.headersSent) sendJson(res, 400, { ok: false, code: "REQUEST_ERROR" });
  });
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

  if (url.pathname === "/api/hotkeys" && req.method === "GET") {
    sendJson(res, 200, hotkeyPayload());
    return;
  }

  if (url.pathname === "/api/hotkeys/config" && req.method === "POST") {
    readHotkeyConfigRequest(req, res);
    return;
  }

  if (url.pathname === "/api/hotkeys/service" && req.method === "POST") {
    readHotkeyServiceRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/bridge" && req.method === "GET") {
    sendJson(res, 200, mapHelperStatus());
    return;
  }

  if (url.pathname === "/api/cheat-automations/run" && req.method === "POST") {
    readCheatAutomationRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/runes" && req.method === "POST") {
    readRuneAutomationRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/items" && req.method === "GET") {
    sendItemLookup(url, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/items" && req.method === "POST") {
    readItemAutomationRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/bosses" && req.method === "GET") {
    sendBossInspection(res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/bosses" && req.method === "POST") {
    readBossAutomationRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/character-stats" && req.method === "GET") {
    sendCharacterStatsInspection(res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/character-stats" && req.method === "POST") {
    readCharacterStatsAutomationRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/invincibility" && req.method === "GET") {
    sendInvincibilityInspection(res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/invincibility" && req.method === "POST") {
    readInvincibilityAutomationRequest(req, res);
    return;
  }

  if (url.pathname === "/api/cheat-automations/status" && req.method === "GET") {
    const command = cheatCommands.get(url.searchParams.get("id") || "");
    if (!command) sendJson(res, 404, { ok: false, code: "COMMAND_NOT_FOUND" });
    else sendJson(res, 200, { ok: true, command: serializeCheatCommand(command) });
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
  if (pathname === "/automation" || pathname === "/automation/") pathname = "/automation.html";
  if (pathname === "/hotkeys" || pathname === "/hotkeys/") pathname = "/hotkeys.html";
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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Elden Ring Challenge Overlay`);
  console.log(`Control: http://localhost:${PORT}/control.html`);
  console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`Save: ${getSaveStatus().path || "not configured"}`);
  if (hotkeyConfig.serviceEnabled) setTimeout(startHotkeyService, 100);
});

process.once("exit", () => {
  clearHotkeyLeaseTimer();
  if (hotkeyRuntimePaths?.lease) {
    try { fs.unlinkSync(hotkeyRuntimePaths.lease); }
    catch (_) {}
  }
  if (hotkeyProcess) {
    try { hotkeyProcess.kill(); }
    catch (_) {}
  }
});
