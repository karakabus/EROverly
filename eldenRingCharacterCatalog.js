const fs = require("fs");
const path = require("path");
const {
  directContent,
  normalizeAobPattern,
  parseCheatEntries,
  resolveTablePath
} = require("./eldenRingMapCatalog");

const ATTRIBUTE_GROUP_ID = 1337193298;
const CHARACTER_FIELDS = Object.freeze([
  { key: "level", name: "Level", sourceRecordId: 1337193299, min: 1, max: 713 },
  { key: "vigor", name: "Vigor", sourceRecordId: 1337193300, min: 1, max: 99 },
  { key: "mind", name: "Mind", sourceRecordId: 1337193301, min: 1, max: 99 },
  { key: "endurance", name: "Endurance", sourceRecordId: 1337193302, min: 1, max: 99 },
  { key: "strength", name: "Strength", sourceRecordId: 1337193303, min: 1, max: 99 },
  { key: "dexterity", name: "Dexterity", sourceRecordId: 1337193304, min: 1, max: 99 },
  { key: "intelligence", name: "Intelligence", sourceRecordId: 1337193305, min: 1, max: 99 },
  { key: "faith", name: "Faith", sourceRecordId: 1337193306, min: 1, max: 99 },
  { key: "arcane", name: "Arcane", sourceRecordId: 1337193307, min: 1, max: 99 }
]);

function parseField(xml, entries, definition) {
  const matches = entries.filter(node => node.id === definition.sourceRecordId);
  if (matches.length !== 1) throw new Error(`CT_CHARACTER_FIELD_${definition.sourceRecordId}_COUNT_${matches.length}`);
  const body = directContent(xml, matches[0]);
  const description = (body.match(/<Description>"?([^<"]+)"?<\/Description>/) || [])[1];
  const offsets = [...body.matchAll(/<Offset>([0-9A-Fa-f]+)<\/Offset>/g)].map(match => match[1].toUpperCase());
  if (
    description !== definition.name ||
    !/<VariableType>4 Bytes<\/VariableType>/.test(body) ||
    !/<Address>GameDataMan<\/Address>/.test(body) ||
    offsets.length !== 2
  ) {
    throw new Error(`CT_CHARACTER_FIELD_${definition.sourceRecordId}_CONTRACT_CHANGED`);
  }
  return Object.freeze({ ...definition, offset: offsets[0], dataPointerOffset: offsets[1] });
}

function loadCharacterCatalog(root) {
  const tablePath = resolveTablePath(root);
  if (!fs.existsSync(tablePath)) throw new Error(`CT_NOT_FOUND:${tablePath}`);
  const xml = fs.readFileSync(tablePath, "utf8");
  const entries = parseCheatEntries(xml);
  const groupMatches = entries.filter(node => node.id === ATTRIBUTE_GROUP_ID);
  if (groupMatches.length !== 1) throw new Error(`CT_CHARACTER_GROUP_${ATTRIBUTE_GROUP_ID}_COUNT_${groupMatches.length}`);

  const gameDataMatch = xml.match(/\{name\s*=\s*"GameDataMan",\s*aob\s*=\s*"([^"]+)",\s*offset\s*=\s*(\d+),\s*additional\s*=\s*(\d+)\}/);
  if (!gameDataMatch) throw new Error("CT_GAME_DATA_PATTERN_NOT_FOUND");
  const fields = CHARACTER_FIELDS.map(definition => parseField(xml, entries, definition));
  const pointerOffsets = new Set(fields.map(field => field.dataPointerOffset));
  if (pointerOffsets.size !== 1) throw new Error("CT_CHARACTER_DATA_POINTER_OFFSETS_DIFFER");

  return Object.freeze({
    tablePath,
    sourceGroupId: ATTRIBUTE_GROUP_ID,
    gameDataPattern: normalizeAobPattern(gameDataMatch[1]),
    gameDataRipOffset: Number(gameDataMatch[2]),
    gameDataRipAdditional: Number(gameDataMatch[3]),
    dataPointerOffset: fields[0].dataPointerOffset,
    fields: Object.freeze(fields),
    byKey: new Map(fields.map(field => [field.key, field]))
  });
}

function manifestHeader(catalog) {
  return [
    "EROVERLY_CHARACTER_STATS_V1",
    `GAME_DATA_PATTERN\t${catalog.gameDataPattern}`,
    `GAME_DATA_RIP\t${catalog.gameDataRipOffset}\t${catalog.gameDataRipAdditional}`,
    `DATA_POINTER\t${catalog.dataPointerOffset}`,
    ...catalog.fields.map(field => `STAT_FIELD\t${field.key}\t${field.offset}\t${field.min}\t${field.max}`)
  ];
}

function writeCharacterInspectManifest(catalog, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${manifestHeader(catalog).join("\n")}\n`, "utf8");
}

function writeCharacterManifest(catalog, values, targetPath) {
  const lines = manifestHeader(catalog);
  for (const [key, rawValue] of Object.entries(values || {})) {
    const field = catalog.byKey.get(key);
    const value = Number(rawValue);
    if (!field || !Number.isSafeInteger(value) || value < field.min || value > field.max) {
      throw new Error(`INVALID_CHARACTER_STAT:${key}`);
    }
    lines.push(`STAT_SET\t${key}\t${value}`);
  }
  if (lines.length === manifestHeader(catalog).length) throw new Error("NO_CHARACTER_STAT_CHANGES");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  ATTRIBUTE_GROUP_ID,
  CHARACTER_FIELDS,
  loadCharacterCatalog,
  writeCharacterInspectManifest,
  writeCharacterManifest
};
