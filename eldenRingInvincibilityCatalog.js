const fs = require("fs");
const path = require("path");
const {
  directContent,
  normalizeAobPattern,
  parseCheatEntries,
  resolveTablePath
} = require("./eldenRingMapCatalog");

const PLAYER_NO_DEAD_RECORD_ID = 1337309231;
const ALL_NO_DEAD_RECORD_ID = 1337304805;
const INVINCIBILITY_FIELDS = Object.freeze([
  Object.freeze({
    key: "player",
    sourceRecordId: PLAYER_NO_DEAD_RECORD_ID,
    description: "NoDead",
    offset: "0"
  }),
  Object.freeze({
    key: "bosses",
    sourceRecordId: ALL_NO_DEAD_RECORD_ID,
    description: "All No Dead",
    offset: "A"
  })
]);

function uniqueEntry(entries, id) {
  const matches = entries.filter(node => node.id === id);
  if (matches.length !== 1) throw new Error(`CT_INVINCIBILITY_RECORD_${id}_COUNT_${matches.length}`);
  return matches[0];
}

function loadInvincibilityCatalog(root) {
  const tablePath = resolveTablePath(root);
  if (!fs.existsSync(tablePath)) throw new Error(`CT_NOT_FOUND:${tablePath}`);
  const xml = fs.readFileSync(tablePath, "utf8");
  const entries = parseCheatEntries(xml);
  const patternMatch = xml.match(
    /\{name\s*=\s*"CHR_DBG_FLAGS",\s*aob\s*=\s*"([^"]+)",\s*offset\s*=\s*(\d+),\s*additional\s*=\s*(\d+)\}/
  );
  if (!patternMatch) throw new Error("CT_CHR_DBG_FLAGS_PATTERN_NOT_FOUND");

  const playerBody = directContent(xml, uniqueEntry(entries, PLAYER_NO_DEAD_RECORD_ID));
  if (
    !/<Description>"NoDead"<\/Description>/.test(playerBody) ||
    !/<VariableType>Auto Assembler Script<\/VariableType>/.test(playerBody) ||
    !/\[ENABLE\][\s\S]*?CHR_DBG_FLAGS\+0:\s*\r?\n\s*db\s+01/i.test(playerBody) ||
    !/\[DISABLE\][\s\S]*?CHR_DBG_FLAGS\+0:\s*\r?\n\s*db\s+00/i.test(playerBody)
  ) {
    throw new Error(`CT_INVINCIBILITY_RECORD_${PLAYER_NO_DEAD_RECORD_ID}_CONTRACT_CHANGED`);
  }

  const bossesBody = directContent(xml, uniqueEntry(entries, ALL_NO_DEAD_RECORD_ID));
  if (
    !/<Description>"All No Dead"<\/Description>/.test(bossesBody) ||
    !/<VariableType>Byte<\/VariableType>/.test(bossesBody) ||
    !/<Address>CHR_DBG_FLAGS\+A<\/Address>/.test(bossesBody)
  ) {
    throw new Error(`CT_INVINCIBILITY_RECORD_${ALL_NO_DEAD_RECORD_ID}_CONTRACT_CHANGED`);
  }

  return Object.freeze({
    tablePath,
    pattern: normalizeAobPattern(patternMatch[1]),
    ripOffset: Number(patternMatch[2]),
    ripAdditional: Number(patternMatch[3]),
    fields: INVINCIBILITY_FIELDS,
    byKey: new Map(INVINCIBILITY_FIELDS.map(field => [field.key, field]))
  });
}

function manifestHeader(catalog) {
  return [
    "EROVERLY_INVINCIBILITY_V1",
    `PATTERN\t${catalog.pattern}`,
    `RIP\t${catalog.ripOffset}\t${catalog.ripAdditional}`,
    ...catalog.fields.map(field => `INVINCIBILITY_FIELD\t${field.key}\t${field.offset}`)
  ];
}

function writeInvincibilityInspectManifest(catalog, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${manifestHeader(catalog).join("\n")}\n`, "utf8");
}

function writeInvincibilityManifest(catalog, values, targetPath) {
  const lines = manifestHeader(catalog);
  let changes = 0;
  for (const [key, rawValue] of Object.entries(values || {})) {
    const field = catalog.byKey.get(key);
    if (!field || typeof rawValue !== "boolean") throw new Error(`INVALID_INVINCIBILITY_STATE:${key}`);
    lines.push(`INVINCIBILITY_SET\t${key}\t${rawValue ? 1 : 0}`);
    changes++;
  }
  if (!changes) throw new Error("NO_INVINCIBILITY_CHANGES");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  ALL_NO_DEAD_RECORD_ID,
  INVINCIBILITY_FIELDS,
  PLAYER_NO_DEAD_RECORD_ID,
  loadInvincibilityCatalog,
  writeInvincibilityInspectManifest,
  writeInvincibilityManifest
};
