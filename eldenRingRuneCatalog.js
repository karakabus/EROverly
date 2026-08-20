const fs = require("fs");
const path = require("path");
const { normalizeAobPattern } = require("./eldenRingMapCatalog");

const DEFAULT_TABLE_NAME = "eldenring_all-in-one_Hexinton-v5.0_ce7.5.ct";
const ADD_RUNES_RECORD_ID = 1337192510;
const MAX_RUNES = 999999999;

function resolveTablePath(root) {
  const configured = String(process.env.ER_CHEAT_TABLE_PATH || "").trim();
  return path.resolve(configured || path.join(root, DEFAULT_TABLE_NAME));
}

function loadRuneCatalog(root) {
  const tablePath = resolveTablePath(root);
  if (!fs.existsSync(tablePath)) throw new Error(`CT_NOT_FOUND:${tablePath}`);
  const xml = fs.readFileSync(tablePath, "utf8");

  const worldMatch = xml.match(/\{name\s*=\s*"WorldChrMan",\s*aob\s*=\s*"([^"]+)",\s*offset\s*=\s*(\d+),\s*additional\s*=\s*(\d+)\}/);
  if (!worldMatch) throw new Error("CT_WORLD_CHR_PATTERN_NOT_FOUND");

  const addRunesMatch = xml.match(
    new RegExp(`<ID>${ADD_RUNES_RECORD_ID}<\\/ID>[\\s\\S]*?<AssemblerScript>([\\s\\S]*?)<\\/AssemblerScript>`)
  );
  if (!addRunesMatch) throw new Error("CT_ADD_RUNES_SCRIPT_NOT_FOUND");
  const script = addRunesMatch[1];

  const addSoulMatch = script.match(/aobscanmodule\(AddSoul_Call,eldenring\.exe,([^)]+)\)/i);
  const pointerOffsets = [...script.matchAll(/mov\s+rcx,\[rcx\+([0-9A-F]+)\]/gi)].map(match => match[1].toUpperCase());
  if (!addSoulMatch || pointerOffsets.length !== 2) throw new Error("CT_ADD_RUNES_CONTRACT_CHANGED");
  if (!/mov\s+edx,edi\s*\r?\n\s*call\s+AddSoul_Call/i.test(script)) {
    throw new Error("CT_ADD_RUNES_CALL_CHANGED");
  }

  return Object.freeze({
    tablePath,
    sourceRecordId: ADD_RUNES_RECORD_ID,
    worldPattern: normalizeAobPattern(worldMatch[1]),
    worldRipOffset: Number(worldMatch[2]),
    worldRipAdditional: Number(worldMatch[3]),
    addSoulPattern: normalizeAobPattern(addSoulMatch[1]),
    localPlayerOffset: pointerOffsets[0],
    runeContainerOffset: pointerOffsets[1],
    runeValueOffset: "6C",
    maxRunes: MAX_RUNES
  });
}

function writeRuneManifest(catalog, amount, targetPath) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > catalog.maxRunes) {
    throw new Error("INVALID_RUNE_AMOUNT");
  }
  const lines = [
    "EROVERLY_RUNES_V1",
    `WORLD_PATTERN\t${catalog.worldPattern}`,
    `WORLD_RIP\t${catalog.worldRipOffset}\t${catalog.worldRipAdditional}`,
    `ADD_SOUL_PATTERN\t${catalog.addSoulPattern}`,
    `POINTERS\t${catalog.localPlayerOffset}\t${catalog.runeContainerOffset}\t${catalog.runeValueOffset}`,
    `AMOUNT\t${amount}`
  ];
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  ADD_RUNES_RECORD_ID,
  MAX_RUNES,
  loadRuneCatalog,
  writeRuneManifest
};
