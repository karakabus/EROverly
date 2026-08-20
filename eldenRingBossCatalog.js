const fs = require("fs");
const path = require("path");
const {
  directContent,
  normalizeAobPattern,
  parseCheatEntries,
  resolveTablePath
} = require("./eldenRingMapCatalog");

const BOSS_GROUP_IDS = Object.freeze({
  mainGame: 1337304929,
  dlc: 1337314897
});

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function readDescription(xml, node) {
  const header = directContent(xml, node);
  const match = header.match(/<Description>([\s\S]*?)<\/Description>/);
  return decodeXml(match ? match[1] : "").replace(/^"|"$/g, "").trim();
}

function parseBinaryOperation(xml, node) {
  const body = directContent(xml, node);
  if (!/<VariableType>Binary<\/VariableType>/.test(body)) return null;

  const bitStartMatch = body.match(/<BitStart>(\d+)<\/BitStart>/);
  const bitLengthMatch = body.match(/<BitLength>(\d+)<\/BitLength>/);
  const offsets = [...body.matchAll(/<Offset>([0-9A-Fa-f]+)<\/Offset>/g)].map(match => match[1].toUpperCase());
  const inlineAddress = body.match(
    /<Address>\[\[EventFlagMan\]\+([0-9A-Fa-f]+)\]\+([0-9A-Fa-f]+)<\/Address>/
  );
  const isOffsetAddress = /<Address>EventFlagMan<\/Address>/.test(body);
  if (!inlineAddress && !isOffsetAddress) return null;
  if (
    !bitStartMatch ||
    !bitLengthMatch ||
    Number(bitLengthMatch[1]) !== 1 ||
    (inlineAddress ? offsets.length !== 0 : offsets.length !== 2)
  ) {
    throw new Error(`CT_UNSUPPORTED_BOSS_FLAG_ENTRY_${node.id || "UNKNOWN"}`);
  }

  const bit = Number(bitStartMatch[1]);
  if (bit < 0 || bit > 7) throw new Error(`CT_INVALID_BOSS_BIT_${node.id || "UNKNOWN"}`);
  return {
    recordId: node.id,
    byteOffset: inlineAddress ? inlineAddress[2].toUpperCase() : offsets[0],
    pointerOffset: inlineAddress ? inlineAddress[1].toUpperCase() : offsets[1],
    bit
  };
}

function uniqueOperations(operations) {
  const unique = new Map();
  for (const operation of operations) {
    unique.set(`${operation.byteOffset}:${operation.pointerOffset}:${operation.bit}`, operation);
  }
  return [...unique.values()];
}

function collectBinaryOperations(xml, node, output = []) {
  const operation = parseBinaryOperation(xml, node);
  if (operation) output.push(operation);
  for (const child of node.children) collectBinaryOperations(xml, child, output);
  return output;
}

function collectCtBosses(xml, groupNode, dlc) {
  const bosses = [];

  function visit(node, regionName) {
    const header = directContent(xml, node);
    const description = readDescription(xml, node);
    const isGroup = /<GroupHeader>1<\/GroupHeader>/.test(header);
    const operation = parseBinaryOperation(xml, node);
    const nextRegion = isGroup && description && !operation ? description : regionName;

    if (operation && description) {
      bosses.push({
        sourceRecordId: node.id,
        sourceName: description,
        sourceRegionName: regionName || "",
        dlc,
        operations: uniqueOperations(collectBinaryOperations(xml, node))
      });
      return;
    }

    for (const child of node.children) visit(child, nextRegion);
  }

  for (const child of groupNode.children) visit(child, "");
  return bosses;
}

function operationKey(operation) {
  return `${String(operation.byteOffset).toUpperCase()}:${String(operation.pointerOffset).toUpperCase()}:${Number(operation.bit)}`;
}

function loadEventFlagBlocks(root) {
  return new Map(
    fs.readFileSync(path.join(root, "eventflag_bst.txt"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map(line => line.split(",").map(Number))
  );
}

function calculateFlagOperation(flagId, eventFlagBlocks) {
  const flag = Number(flagId);
  if (!Number.isFinite(flag) || flag < 0) return null;
  const block = Math.floor(flag / 1000);
  const index = flag % 1000;
  const offsetBlock = eventFlagBlocks.get(block);
  if (!Number.isFinite(offsetBlock)) return null;
  return {
    byteOffset: (offsetBlock * 125 + Math.floor(index / 8)).toString(16).toUpperCase(),
    pointerOffset: "28",
    bit: 7 - (index % 8)
  };
}

function normalizeBossName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bx\s*\d+\b/g, " ")
    .replace(/\bboss\b/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\brenalla\b/g, "rellana")
    .replace(/\bfaram\b/g, "farum")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseNameMatchedSource(appBoss, sources) {
  const wanted = normalizeBossName(appBoss.name);
  let candidates = sources.filter(source => normalizeBossName(source.sourceName) === wanted);
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const place = normalizeBossName(appBoss.place);
  if (place) {
    const placeMatches = candidates.filter(source => normalizeBossName(source.sourceName).includes(place));
    if (placeMatches.length === 1) return placeMatches[0];
  }
  const region = normalizeBossName(appBoss.regionName);
  const regionMatches = candidates.filter(source => normalizeBossName(source.sourceRegionName) === region);
  return regionMatches.length === 1 ? regionMatches[0] : null;
}

function loadBossCatalog(root, appRegions) {
  const tablePath = resolveTablePath(root);
  if (!fs.existsSync(tablePath)) throw new Error(`CT_NOT_FOUND:${tablePath}`);

  const xml = fs.readFileSync(tablePath, "utf8");
  const entries = parseCheatEntries(xml);
  const aobMatch = xml.match(/\{name\s*=\s*"EventFlagMan",\s*aob\s*=\s*"([^"]+)",\s*offset\s*=\s*(\d+),\s*additional\s*=\s*(\d+)\}/);
  if (!aobMatch) throw new Error("CT_EVENT_FLAG_PATTERN_NOT_FOUND");

  const ctBosses = [];
  for (const [group, groupId] of Object.entries(BOSS_GROUP_IDS)) {
    const matches = entries.filter(node => node.id === groupId);
    if (matches.length !== 1) throw new Error(`CT_BOSS_GROUP_${groupId}_COUNT_${matches.length}`);
    ctBosses.push(...collectCtBosses(xml, matches[0], group === "dlc"));
  }

  const flagMap = JSON.parse(fs.readFileSync(path.join(root, "bossFlagMap.json"), "utf8"));
  const stateMap = JSON.parse(fs.readFileSync(path.join(root, "bossStateMap.json"), "utf8"));
  const eventFlagBlocks = loadEventFlagBlocks(root);
  const byOperation = new Map();
  for (const boss of ctBosses) {
    for (const operation of boss.operations) {
      const key = operationKey(operation);
      if (!byOperation.has(key)) byOperation.set(key, []);
      byOperation.get(key).push(boss);
    }
  }

  const bosses = [];
  for (const region of appRegions) {
    for (const appBoss of region.bosses || []) {
      const stateInfo = stateMap[appBoss.id] || {};
      const displayFlagId = Number(stateInfo.displayFlagId || appBoss.flagId);
      const flag = flagMap[String(displayFlagId)];
      const displayOperation = flag
        ? { byteOffset: Number(flag.offset).toString(16).toUpperCase(), pointerOffset: "28", bit: Number(flag.bit) }
        : calculateFlagOperation(displayFlagId, eventFlagBlocks);
      const matches = displayOperation ? byOperation.get(operationKey(displayOperation)) || [] : [];
      const source = matches.length === 1 ? matches[0] : null;
      const operations = uniqueOperations([
        ...(source?.operations || []),
        ...(displayOperation ? [displayOperation] : [])
      ]);
      bosses.push({
        id: appBoss.id,
        name: appBoss.name,
        place: appBoss.place || "",
        regionName: region.regionName,
        dlc: Boolean(region.dlc),
        displayFlagId,
        displayOperation,
        sourceRecordId: source?.sourceRecordId || null,
        sourceName: source?.sourceName || null,
        sourceRegionName: source?.sourceRegionName || null,
        operations,
        writable: Boolean(displayOperation)
      });
    }
  }

  const usedSourceIds = new Set(bosses.map(boss => boss.sourceRecordId).filter(Boolean));
  for (const boss of bosses) {
    if (boss.sourceRecordId) continue;
    const source = chooseNameMatchedSource(
      boss,
      ctBosses.filter(candidate => !usedSourceIds.has(candidate.sourceRecordId) && candidate.dlc === boss.dlc)
    );
    if (!source) continue;
    boss.sourceRecordId = source.sourceRecordId;
    boss.sourceName = source.sourceName;
    boss.sourceRegionName = source.sourceRegionName;
    boss.operations = uniqueOperations([...source.operations, boss.displayOperation]);
    usedSourceIds.add(source.sourceRecordId);
  }

  return Object.freeze({
    tablePath,
    tableName: path.basename(tablePath),
    tableVersion: (xml.match(/<CheatTable\s+CheatEngineTableVersion="([^"]+)"/) || [])[1] || null,
    eventFlagPattern: normalizeAobPattern(aobMatch[1]),
    ripOffset: Number(aobMatch[2]),
    ripAdditional: Number(aobMatch[3]),
    sourceBossCount: ctBosses.length,
    matchedSourceCount: bosses.filter(boss => boss.sourceRecordId).length,
    bosses: Object.freeze(bosses)
  });
}

function writeBossManifest(catalog, changes, targetPath) {
  const lines = [
    "EROVERLY_BOSSES_V1",
    `PATTERN\t${catalog.eventFlagPattern}`,
    `RIP\t${catalog.ripOffset}\t${catalog.ripAdditional}`
  ];

  for (const change of changes) {
    const boss = catalog.bosses.find(item => item.id === change.id);
    if (!boss || !boss.writable) throw new Error(`UNKNOWN_BOSS:${change.id}`);
    const target = change.state === "dead" ? 1 : change.state === "alive" ? 0 : null;
    if (target === null) throw new Error(`INVALID_BOSS_STATE:${change.state}`);
    lines.push(`BOSS\t${boss.id}\t${target}`);
    for (const operation of boss.operations) {
      lines.push(`BOSS_BIT\t${operation.byteOffset}\t${operation.pointerOffset}\t${operation.bit}`);
    }
    lines.push(`DISPLAY_BIT\t${boss.displayOperation.byteOffset}\t${boss.displayOperation.pointerOffset}\t${boss.displayOperation.bit}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

function writeBossInspectManifest(catalog, targetPath) {
  const lines = [
    "EROVERLY_BOSSES_V1",
    `PATTERN\t${catalog.eventFlagPattern}`,
    `RIP\t${catalog.ripOffset}\t${catalog.ripAdditional}`
  ];
  for (const boss of catalog.bosses) {
    if (!boss.writable) continue;
    lines.push(`BOSS\t${boss.id}\t0`);
    lines.push(`DISPLAY_BIT\t${boss.displayOperation.byteOffset}\t${boss.displayOperation.pointerOffset}\t${boss.displayOperation.bit}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  BOSS_GROUP_IDS,
  loadBossCatalog,
  writeBossInspectManifest,
  writeBossManifest
};
