const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CONFIG_PATH = path.join(__dirname, "save_file_path.js");
const RUNTIME_SAVE_CONFIG_PATH = path.join(__dirname, ".runtime", "save-path.json");
const BOSS_DATA_PATH = path.join(__dirname, "bosses.json");
const BOSS_FLAG_MAP_PATH = path.join(__dirname, "bossFlagMap.json");
const BOSS_STATE_MAP_PATH = path.join(__dirname, "bossStateMap.json");
const EVENTFLAG_BST_PATH = path.join(__dirname, "eventflag_bst.txt");
const DEFAULT_SAVE_NAME = "ER0000.sl2";
const POLL_MS = 2000;
const PC_SLOT_HEADER_SIZE = 0x10;
const SLOT_SIZE = 0x280000;
const EVENT_FLAGS_SIZE = 0x1bf99f;
const FALLBACK_MAGIC_OFFSET = 0x15420 + 432;
const OFF_CHARACTER_NAME = -0x11b;
const CHARACTER_SUMMARY_ENTRY = "USER_DATA010";
const CHARACTER_SUMMARY_SLOT_COUNT = 10;
const CHARACTER_SUMMARY_MENU_OFFSET = 0x10 + 0x04 + 0x08 + 0x140;
const CHARACTER_SUMMARY_STRIDE = 0x24c;
const CHARACTER_SUMMARY_LEVEL_OFFSET = 0x22;
const CHARACTER_SUMMARY_PLAY_TIME_OFFSET = 0x26;
const DEATH_SCAN_START = 15000;
const DEATH_SCAN_END = 300000;
const DEATH_ZERO_RUN_MIN = 50000;
const MAX_PROJECTILES = 200000;
const MAX_UNLOCKED_REGIONS = 20000;

const MAGIC_PATTERN = Buffer.from([
  0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

let status = {
  configured: false,
  watching: false,
  path: null,
  exists: false,
  size: null,
  mtimeMs: null,
  hash: null,
  characters: [],
  lastChangedAt: null,
  lastCheckedAt: null,
  error: null
};

let lastFingerprint = null;
let bossProgressBySlot = {};
let bossCatalogCache = null;
let bossFlagMapCache = null;
let bossStateMapCache = null;
let eventFlagBstCache = null;

function expandHome(value) {
  if (value === "~") return process.env.HOME || value;
  if (value.startsWith("~/")) return path.join(process.env.HOME || "", value.slice(2));
  return value;
}

function resolveSavePath(value) {
  const clean = expandHome(String(value || "").trim());
  if (!clean) return null;
  const ext = path.extname(clean).toLowerCase();
  return ext === ".sl2" || ext === ".co2" ? clean : path.join(clean, DEFAULT_SAVE_NAME);
}

function readConfiguredSavePath() {
  if (process.env.ER_SAVE_PATH) return resolveSavePath(process.env.ER_SAVE_PATH);
  const runtimeSavePath = readRuntimeSavePath();
  if (runtimeSavePath) return resolveSavePath(runtimeSavePath);
  if (!fs.existsSync(CONFIG_PATH)) return null;

  const source = fs.readFileSync(CONFIG_PATH, "utf8");
  const match = source.match(/\bsavefile\s*=\s*["']([^"']+)["']/);
  if (!match) {
    throw new Error("save_file_path.js icinde savefile yolu bulunamadi");
  }
  return resolveSavePath(match[1]);
}

function readRuntimeSavePath() {
  if (!fs.existsSync(RUNTIME_SAVE_CONFIG_PATH)) return null;
  try {
    const source = JSON.parse(fs.readFileSync(RUNTIME_SAVE_CONFIG_PATH, "utf8"));
    return source && source.path ? source.path : null;
  } catch (_) {
    return null;
  }
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha1");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function readUtf16String(buffer, offset) {
  const chars = [];
  for (let i = offset; i + 1 < buffer.length; i += 2) {
    const code = buffer.readUInt16LE(i);
    if (!code) break;
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

function loadBossCatalog() {
  if (!bossCatalogCache) {
    const regions = JSON.parse(fs.readFileSync(BOSS_DATA_PATH, "utf8"));
    bossCatalogCache = regions.map((region, regionIndex) => ({
      regionName: region.region_name,
      dlc: regionIndex >= 23,
      bosses: (region.bosses || []).map((boss, bossIndex) => ({
        id: `${regionIndex}:${bossIndex}`,
        name: boss.boss,
        place: boss.place || "",
        flagId: Number(boss.flag_id)
      }))
    }));
  }
  return bossCatalogCache;
}

function loadBossFlagMap() {
  if (!bossFlagMapCache) {
    bossFlagMapCache = JSON.parse(fs.readFileSync(BOSS_FLAG_MAP_PATH, "utf8"));
  }
  return bossFlagMapCache;
}

function loadBossStateMap() {
  if (!bossStateMapCache) {
    bossStateMapCache = JSON.parse(fs.readFileSync(BOSS_STATE_MAP_PATH, "utf8"));
  }
  return bossStateMapCache;
}

function loadEventFlagBst() {
  if (!eventFlagBstCache) {
    eventFlagBstCache = new Map(
      fs.readFileSync(EVENTFLAG_BST_PATH, "utf8")
        .trim()
        .split(/\r?\n/)
        .map(line => line.split(",").map(Number))
    );
  }
  return eventFlagBstCache;
}

function calculateFlagInfo(flagId) {
  const flag = Number(flagId);
  if (!Number.isFinite(flag) || flag < 0) return null;
  const block = Math.floor(flag / 1000);
  const index = flag % 1000;
  const offsetBlock = loadEventFlagBst().get(block);
  if (!Number.isFinite(offsetBlock)) return null;
  return {
    offset: offsetBlock * 125 + Math.floor(index / 8),
    bit: 7 - (index % 8)
  };
}

function getFlagInfo(flagMap, flagId) {
  return flagMap[String(flagId)] || calculateFlagInfo(flagId);
}

function isLikelyCharacterName(value) {
  if (!value || value.length < 3 || value.length > 32) return false;
  if (!/[A-Za-z0-9]/.test(value)) return false;
  return /^[A-Za-z0-9 _.'-]+$/.test(value);
}

function findMagicOffset(saveSlotBuffer) {
  return findMagicPatternOffset(saveSlotBuffer) ?? FALLBACK_MAGIC_OFFSET;
}

function findMagicPatternOffset(saveSlotBuffer) {
  const found = saveSlotBuffer.indexOf(MAGIC_PATTERN);
  return found >= 400 ? found : null;
}

function findCharacterNameByMagic(saveSlotBuffer, rawSlotBuffer) {
  const magicOffset = findMagicOffset(saveSlotBuffer);
  const offset = magicOffset + OFF_CHARACTER_NAME;
  if (offset < 0 || offset + 2 >= saveSlotBuffer.length) return null;

  const value = readUtf16String(saveSlotBuffer, offset).trim();
  if (!isLikelyCharacterName(value)) return null;
  return {
    offset: rawSlotBuffer && rawSlotBuffer.length !== saveSlotBuffer.length ? offset + PC_SLOT_HEADER_SIZE : offset,
    value
  };
}

function findCharacterNameByScan(slotBuffer) {
  const end = Math.min(slotBuffer.length - 2, 0xc000);
  const candidates = [];

  for (let offset = 0x8000; offset < end; offset += 2) {
    let length = 0;
    for (let i = offset; i < Math.min(offset + 80, end); i += 2) {
      const code = slotBuffer.readUInt16LE(i);
      if (code >= 32 && code <= 126) length++;
      else break;
    }

    if (length >= 3) {
      const value = slotBuffer.subarray(offset, offset + length * 2).toString("utf16le").trim();
      if (isLikelyCharacterName(value)) candidates.push({ offset, value });
      offset += length * 2;
    }
  }

  return candidates.length ? candidates[0] : null;
}

function findCharacterName(saveSlotBuffer, rawSlotBuffer) {
  const found = findCharacterNameByMagic(saveSlotBuffer, rawSlotBuffer);
  if (findMagicPatternOffset(saveSlotBuffer) !== null || found) return found;
  return findCharacterNameByScan(rawSlotBuffer || saveSlotBuffer);
}

function parseBnd4Entries(buffer) {
  if (buffer.subarray(0, 4).toString("ascii") !== "BND4") return [];

  const count = buffer.readUInt32LE(0x0c);
  const entries = [];
  for (let index = 0; index < count; index++) {
    const entryOffset = 0x40 + index * 0x20;
    if (entryOffset + 0x20 > buffer.length) break;

    const size = buffer.readUInt32LE(entryOffset + 8);
    const dataOffset = buffer.readUInt32LE(entryOffset + 16);
    const nameOffset = buffer.readUInt32LE(entryOffset + 20);
    const name = readUtf16String(buffer, nameOffset);

    if (dataOffset > 0 && dataOffset + size <= buffer.length) {
      entries.push({ index, name, dataOffset, size });
    }
  }
  return entries;
}

function getSaveSlotBuffer(containerBuffer, entry) {
  const rawSlotBuffer = containerBuffer.subarray(entry.dataOffset, entry.dataOffset + entry.size);
  if (rawSlotBuffer.length >= SLOT_SIZE + PC_SLOT_HEADER_SIZE) {
    return {
      rawSlotBuffer,
      saveSlotBuffer: rawSlotBuffer.subarray(PC_SLOT_HEADER_SIZE, PC_SLOT_HEADER_SIZE + SLOT_SIZE)
    };
  }
  return {
    rawSlotBuffer,
    saveSlotBuffer: rawSlotBuffer.subarray(0, Math.min(rawSlotBuffer.length, SLOT_SIZE))
  };
}

function readCharacterSummaryProfiles(containerBuffer, entries) {
  const summaryEntry = entries.find(entry => entry.name === CHARACTER_SUMMARY_ENTRY);
  if (!summaryEntry) return null;

  const summaryBuffer = containerBuffer.subarray(summaryEntry.dataOffset, summaryEntry.dataOffset + summaryEntry.size);
  if (CHARACTER_SUMMARY_MENU_OFFSET + 8 > summaryBuffer.length) return null;

  const menuLength = summaryBuffer.readUInt32LE(CHARACTER_SUMMARY_MENU_OFFSET + 4);
  const activeSlotsOffset = CHARACTER_SUMMARY_MENU_OFFSET + 8 + menuLength;
  const profileSummariesOffset = activeSlotsOffset + CHARACTER_SUMMARY_SLOT_COUNT;
  if (activeSlotsOffset + CHARACTER_SUMMARY_SLOT_COUNT > summaryBuffer.length) return null;

  const profilesBySlot = new Map();

  for (let slot = 0; slot < CHARACTER_SUMMARY_SLOT_COUNT; slot++) {
    if (summaryBuffer[activeSlotsOffset + slot] !== 1) continue;

    const offset = profileSummariesOffset + slot * CHARACTER_SUMMARY_STRIDE;
    if (offset + 2 >= summaryBuffer.length) break;

    const name = readUtf16String(summaryBuffer, offset).trim();
    if (isLikelyCharacterName(name)) {
      profilesBySlot.set(slot, {
        name,
        level: summaryBuffer.readUInt32LE(offset + CHARACTER_SUMMARY_LEVEL_OFFSET),
        playTimeSeconds: summaryBuffer.readUInt32LE(offset + CHARACTER_SUMMARY_PLAY_TIME_OFFSET)
      });
    }
  }

  return profilesBySlot;
}

function findZeroRuns(buffer, minLength) {
  const runs = [];
  let start = -1;

  for (let offset = 0; offset < buffer.length; offset++) {
    if (start < 0 && buffer[offset] === 0) {
      start = offset;
      continue;
    }

    if (start >= 0 && buffer[offset] !== 0) {
      if (offset - start >= minLength) runs.push([start, offset - start]);
      start = -1;
    }
  }

  return runs;
}

function findDeathCountOffset(slotBuffer) {
  for (let offset = DEATH_SCAN_START; offset < slotBuffer.length && offset < DEATH_SCAN_END;) {
    if (slotBuffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const runStart = offset;
    while (slotBuffer[offset] === 0xff) offset++;
    if (offset - runStart !== 4 || slotBuffer[offset + 1] !== 8) continue;

    let zerosSeen = 0;
    const windowEnd = Math.min(slotBuffer.length, offset + 47);
    for (let scan = offset + 2; scan < windowEnd; scan++) {
      if (slotBuffer[scan] === 0) zerosSeen++;
      if (slotBuffer[scan] === 8) {
        if (zerosSeen >= 20) return offset - 8;
        break;
      }
    }
  }

  return -1;
}

function findNextFfPair(buffer, start) {
  let firstFf = -1;
  for (let offset = start; offset < buffer.length; offset++) {
    if (firstFf < 0) {
      if (buffer[offset] === 0xff) firstFf = offset;
      continue;
    }

    if (buffer[offset] === 0xff && offset - firstFf === 3) return firstFf;
    if (buffer[offset] !== 0xff) firstFf = -1;
  }
  return -1;
}

function readDeathCount(rawSlotBuffer) {
  const slotBuffer = rawSlotBuffer.subarray(0, Math.min(rawSlotBuffer.length, SLOT_SIZE));
  let offset = findDeathCountOffset(slotBuffer);

  if (offset < 0 || offset <= 200000 || offset >= DEATH_SCAN_END) {
    const zeroRuns = findZeroRuns(slotBuffer, DEATH_ZERO_RUN_MIN);
    if (!zeroRuns.length) return null;

    const firstZeroRun = zeroRuns.reduce((best, run) => (run[0] < best[0] ? run : best), [Infinity, 0]);
    const ffOffset = findNextFfPair(slotBuffer, firstZeroRun[0]);
    if (ffOffset <= 200000 || ffOffset >= DEATH_SCAN_END) return null;
    offset = ffOffset - 4;
  }

  if (offset < 0 || offset + 4 > slotBuffer.length) return null;
  return slotBuffer.readUInt32LE(offset);
}

function readDynamicCount(buffer, offset, max, label) {
  if (offset < 0 || offset + 4 > buffer.length) {
    throw new Error(`${label} offset save slot disinda`);
  }
  const value = buffer.readUInt32LE(offset);
  if (value > max) throw new Error(`${label} beklenenden buyuk: ${value}`);
  return value;
}

function calculateEventFlagsOffset(saveSlotBuffer) {
  const magicOffset = findMagicOffset(saveSlotBuffer);

  const playerData = magicOffset;
  const spEffect = playerData + 0xd0;
  const equippedItemIndex = spEffect + 0x58;
  const activeEquippedItems = equippedItemIndex + 0x1c;
  const equippedItemsId = activeEquippedItems + 0x58;
  const activeEquippedItemsGa = equippedItemsId + 0x58;
  const inventoryHeld = activeEquippedItemsGa + 0x9011;
  const equippedSpells = inventoryHeld + 0x74;
  const equippedItems = equippedSpells + 0x8c;
  const equippedGestures = equippedItems + 0x18;

  const projectileCount = readDynamicCount(saveSlotBuffer, equippedGestures, MAX_PROJECTILES, "projectileCount");
  const equippedProjectile = equippedGestures + projectileCount * 8 + 4;
  const equippedArmaments = equippedProjectile + 0x9c;
  const equipePhysics = equippedArmaments + 0x0c;
  const faceData = equipePhysics + 0x12f;
  const storageEnd = faceData + 0x6010;
  const gestures = storageEnd + 0x100;

  const regionCount = readDynamicCount(saveSlotBuffer, gestures, MAX_UNLOCKED_REGIONS, "regionCount");
  const unlockedRegion = gestures + regionCount * 4 + 4;
  const horse = unlockedRegion + 0x29;
  const bloodStain = horse + 0x4c;
  const menuProfile = bloodStain + 0x103c;
  const gaItemDataEnd = menuProfile + 0x1b588;
  const eventFlagsOffset = gaItemDataEnd + 0x425;

  if (eventFlagsOffset <= 0 || eventFlagsOffset + EVENT_FLAGS_SIZE > saveSlotBuffer.length) {
    throw new Error(`event flags offset gecersiz: 0x${eventFlagsOffset.toString(16)}`);
  }

  return eventFlagsOffset;
}

function readEventFlag(saveSlotBuffer, eventFlagsOffset, flagInfo) {
  if (!flagInfo) return false;
  const offset = eventFlagsOffset + Number(flagInfo.offset);
  const bit = Number(flagInfo.bit);
  if (offset < 0 || offset >= saveSlotBuffer.length || bit < 0 || bit > 7) return false;
  return (saveSlotBuffer[offset] & (1 << bit)) !== 0;
}

function getBossState(boss) {
  return loadBossStateMap()[boss.id] || null;
}

function getBossDisplayFlagId(boss) {
  const stateInfo = getBossState(boss);
  return stateInfo ? Number(stateInfo.displayFlagId) : boss.flagId;
}

function isBossMapped(flagMap, boss) {
  const stateInfo = getBossState(boss);
  if (getFlagInfo(flagMap, getBossDisplayFlagId(boss))) return true;
  return Boolean(
    stateInfo &&
      Array.isArray(stateInfo.fallbackFlagIds) &&
      stateInfo.fallbackFlagIds.some(flagId => getFlagInfo(flagMap, flagId))
  );
}

function readBossKilled(saveSlotBuffer, eventFlagsOffset, flagMap, boss) {
  const stateInfo = getBossState(boss);
  const flagInfo = getFlagInfo(flagMap, getBossDisplayFlagId(boss));
  const flagValue = readEventFlag(saveSlotBuffer, eventFlagsOffset, flagInfo);
  const expectedValue = stateInfo ? Boolean(stateInfo.displayWhen) : true;
  if (flagValue === expectedValue) return true;

  if (stateInfo && Array.isArray(stateInfo.fallbackFlagIds)) {
    const fallbackExpectedValue = "fallbackWhen" in stateInfo ? Boolean(stateInfo.fallbackWhen) : expectedValue;
    return stateInfo.fallbackFlagIds.some(flagId => {
      const fallbackInfo = getFlagInfo(flagMap, flagId);
      return readEventFlag(saveSlotBuffer, eventFlagsOffset, fallbackInfo) === fallbackExpectedValue;
    });
  }

  return false;
}

function emptyBossProgress(slot, error) {
  const flagMap = loadBossFlagMap();
  const regions = loadBossCatalog().map(region => ({
    regionName: region.regionName,
    dlc: region.dlc,
    killed: 0,
    total: region.bosses.length,
    bosses: region.bosses.map(boss => ({
      ...boss,
      displayFlagId: getBossDisplayFlagId(boss),
      killed: false,
      mapped: isBossMapped(flagMap, boss)
    }))
  }));
  const total = regions.reduce((sum, region) => sum + region.total, 0);
  return {
    slot,
    readable: false,
    killed: 0,
    total,
    regions,
    updatedAt: Date.now(),
    error: error ? String(error.message || error) : null
  };
}

function buildBossProgress(slot, saveSlotBuffer) {
  try {
    const eventFlagsOffset = calculateEventFlagsOffset(saveSlotBuffer);
    const flagMap = loadBossFlagMap();
    const regions = loadBossCatalog().map(region => {
      const bosses = region.bosses.map(boss => {
        return {
          ...boss,
          displayFlagId: getBossDisplayFlagId(boss),
          killed: readBossKilled(saveSlotBuffer, eventFlagsOffset, flagMap, boss),
          mapped: isBossMapped(flagMap, boss)
        };
      });
      return {
        regionName: region.regionName,
        dlc: region.dlc,
        killed: bosses.reduce((sum, boss) => sum + (boss.killed ? 1 : 0), 0),
        total: bosses.length,
        bosses
      };
    });
    return {
      slot,
      readable: true,
      killed: regions.reduce((sum, region) => sum + region.killed, 0),
      total: regions.reduce((sum, region) => sum + region.total, 0),
      regions,
      eventFlagsOffset,
      updatedAt: Date.now(),
      error: null
    };
  } catch (err) {
    return emptyBossProgress(slot, err);
  }
}

function parseSaveFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parsedAt = Date.now();
  const nextBossProgressBySlot = {};
  const entries = parseBnd4Entries(buffer);
  const summaryProfiles = readCharacterSummaryProfiles(buffer, entries);
  const characters = entries
    .filter(entry => /^USER_DATA00\d$/.test(entry.name))
    .slice(0, 10)
    .map(entry => {
      const slot = Number(entry.name.slice(-3));
      const { rawSlotBuffer, saveSlotBuffer } = getSaveSlotBuffer(buffer, entry);
      const summaryProfile = summaryProfiles ? summaryProfiles.get(slot) : null;
      const found = summaryProfiles
        ? (summaryProfile ? { offset: null, value: summaryProfile.name } : null)
        : findCharacterName(saveSlotBuffer, rawSlotBuffer);
      const deathCount = found ? readDeathCount(rawSlotBuffer) : null;

      nextBossProgressBySlot[slot] = buildBossProgress(slot, saveSlotBuffer);

      return {
        slot,
        fileName: entry.name,
        active: Boolean(found),
        name: found ? found.value : null,
        nameOffset: found ? found.offset : null,
        level: summaryProfile ? summaryProfile.level : null,
        playTimeSeconds: summaryProfile ? summaryProfile.playTimeSeconds : null,
        playTimeReadAt: summaryProfile ? parsedAt : null,
        deathCount,
        size: entry.size
      };
    })
    .filter(character => character.active);

  return { characters, bossProgressBySlot: nextBossProgressBySlot };
}

function parseCharacters(filePath) {
  return parseSaveFile(filePath).characters;
}

function updateMissing(filePath, err) {
  const next = {
    configured: Boolean(filePath),
    watching: true,
    path: filePath,
    exists: false,
    size: null,
    mtimeMs: null,
    hash: null,
    characters: [],
    lastChangedAt: status.lastChangedAt,
    lastCheckedAt: Date.now(),
    error: err ? String(err.message || err) : "Save dosyasi bulunamadi"
  };
  const changed = JSON.stringify(status) !== JSON.stringify(next);
  status = next;
  bossProgressBySlot = {};
  lastFingerprint = null;
  return changed;
}

function checkSaveFile() {
  let savePath;
  try {
    savePath = readConfiguredSavePath();
    if (!savePath) return updateMissing(null, new Error("Save yolu bos"));

    const stat = fs.statSync(savePath);
    if (!stat.isFile()) return updateMissing(savePath, new Error("Save yolu dosya degil"));

    const fingerprint = `${stat.size}:${stat.mtimeMs}`;
    const hash = fingerprint === lastFingerprint && status.hash ? status.hash : hashFile(savePath);
    const changed = hash !== status.hash;
    const parsed = changed || !status.characters.length ? parseSaveFile(savePath) : null;
    const characters = parsed ? parsed.characters : status.characters;
    if (parsed) bossProgressBySlot = parsed.bossProgressBySlot;

    status = {
      configured: true,
      watching: true,
      path: savePath,
      exists: true,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash,
      characters,
      lastChangedAt: changed ? Date.now() : status.lastChangedAt,
      lastCheckedAt: Date.now(),
      error: null
    };
    lastFingerprint = fingerprint;
    return changed;
  } catch (err) {
    return updateMissing(savePath || null, err);
  }
}

function startSaveWatcher(onChange) {
  checkSaveFile();
  const timer = setInterval(() => {
    if (checkSaveFile() && typeof onChange === "function") onChange(getSaveStatus());
  }, POLL_MS);
  return () => clearInterval(timer);
}

function getSaveStatus() {
  checkSaveFile();
  return { ...status };
}

function getBossProgress(slot) {
  const slotNumber = Number(slot);
  if (!Number.isInteger(slotNumber) || slotNumber < 0 || slotNumber > 9) {
    return emptyBossProgress(null, "Karakter slotu secilmedi");
  }
  return bossProgressBySlot[slotNumber] || emptyBossProgress(slotNumber, "Slot henuz okunmadi");
}

module.exports = {
  getBossProgress,
  getBossCatalog: loadBossCatalog,
  getSaveStatus,
  parseCharacters,
  readConfiguredSavePath,
  startSaveWatcher
};
