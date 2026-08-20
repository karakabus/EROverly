const fs = require("fs");
const path = require("path");

const DEFAULT_TABLE_NAME = "eldenring_all-in-one_Hexinton-v5.0_ce7.5.ct";
const MAP_GROUP_IDS = Object.freeze({
  mainGameMaps: 1337314851,
  dlcMaps: 1337314637,
  mainGameGraces: 1337309323,
  dlcGraces: 1337314835
});
// Event flag 82002 (ShowDLCMap). Hexinton v5.0 contains the five DLC map
// fragment flags but omits this layer-visibility flag from its DLC group.
const DLC_MAP_LAYER_OPERATION = Object.freeze({
  eventFlagId: 82002,
  byteOffset: "FA0",
  pointerOffset: "28",
  bit: 5
});

function directContent(xml, node) {
  const firstChild = node.children[0];
  return xml.slice(node.openEnd, firstChild ? firstChild.start : node.closeStart);
}

function parseCheatEntries(xml) {
  const nodes = [];
  const stack = [];
  const tagPattern = /<CheatEntry(?:\s[^>]*)?>|<\/CheatEntry>/g;
  let match;

  while ((match = tagPattern.exec(xml))) {
    if (match[0][1] !== "/") {
      const node = {
        start: match.index,
        openEnd: tagPattern.lastIndex,
        closeStart: null,
        end: null,
        children: []
      };
      if (stack.length) stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    const node = stack.pop();
    if (!node) throw new Error("CT_ENTRY_CLOSE_WITHOUT_OPEN");
    node.closeStart = match.index;
    node.end = tagPattern.lastIndex;
    const header = directContent(xml, node);
    const idMatch = header.match(/<ID>(\d+)<\/ID>/);
    node.id = idMatch ? Number(idMatch[1]) : null;
    nodes.push(node);
  }

  if (stack.length) throw new Error("CT_ENTRY_NOT_CLOSED");
  return nodes;
}

function collectLeafNodes(node, output = []) {
  if (!node.children.length) output.push(node);
  for (const child of node.children) collectLeafNodes(child, output);
  return output;
}

function uniqueOperations(operations) {
  const unique = new Map();
  for (const operation of operations) {
    unique.set(`${operation.byteOffset}:${operation.pointerOffset}:${operation.bit}`, operation);
  }
  return [...unique.values()];
}

function parseMapOperations(xml, groupNode) {
  const operations = [];

  for (const node of collectLeafNodes(groupNode)) {
    const body = xml.slice(node.openEnd, node.closeStart);
    if (!/<VariableType>Binary<\/VariableType>/.test(body)) continue;

    const bitStartMatch = body.match(/<BitStart>(\d+)<\/BitStart>/);
    const bitLengthMatch = body.match(/<BitLength>(\d+)<\/BitLength>/);
    const offsets = [...body.matchAll(/<Offset>([0-9A-Fa-f]+)<\/Offset>/g)].map(match => match[1].toUpperCase());
    const inlineAddress = body.match(
      /<Address>\[\[EventFlagMan\]\+([0-9A-Fa-f]+)\]\+([0-9A-Fa-f]+)<\/Address>/
    );
    const isOffsetAddress = /<Address>EventFlagMan<\/Address>/.test(body);
    if (!inlineAddress && !isOffsetAddress) continue;
    if (
      !bitStartMatch ||
      !bitLengthMatch ||
      Number(bitLengthMatch[1]) !== 1 ||
      (inlineAddress ? offsets.length !== 0 : offsets.length !== 2)
    ) {
      throw new Error(`CT_UNSUPPORTED_EVENT_FLAG_ENTRY_${node.id || "UNKNOWN"}`);
    }

    const bit = Number(bitStartMatch[1]);
    if (bit < 0 || bit > 7) throw new Error(`CT_INVALID_MAP_BIT_${node.id || "UNKNOWN"}`);
    operations.push({
      recordId: node.id,
      byteOffset: inlineAddress ? inlineAddress[2].toUpperCase() : offsets[0],
      pointerOffset: inlineAddress ? inlineAddress[1].toUpperCase() : offsets[1],
      bit
    });
  }

  return uniqueOperations(operations);
}

function normalizeAobPattern(pattern) {
  const bytes = [];
  for (const token of pattern.trim().split(/\s+/)) {
    if (/^[?x]+$/i.test(token)) {
      const byteCount = Math.max(1, Math.ceil(token.length / 2));
      for (let index = 0; index < byteCount; index += 1) bytes.push("??");
      continue;
    }
    if (!/^[0-9a-f]+$/i.test(token) || token.length % 2 !== 0) {
      throw new Error("CT_INVALID_EVENT_FLAG_PATTERN");
    }
    for (let index = 0; index < token.length; index += 2) {
      bytes.push(token.slice(index, index + 2).toUpperCase());
    }
  }
  return bytes.join(" ");
}

function resolveTablePath(root) {
  const configured = String(process.env.ER_CHEAT_TABLE_PATH || "").trim();
  return path.resolve(configured || path.join(root, DEFAULT_TABLE_NAME));
}

function loadMapCatalog(root) {
  const tablePath = resolveTablePath(root);
  if (!fs.existsSync(tablePath)) {
    throw new Error(`CT_NOT_FOUND:${tablePath}`);
  }

  const xml = fs.readFileSync(tablePath, "utf8");
  const entries = parseCheatEntries(xml);
  const aobMatch = xml.match(/\{name\s*=\s*"EventFlagMan",\s*aob\s*=\s*"([^"]+)",\s*offset\s*=\s*(\d+),\s*additional\s*=\s*(\d+)\}/);
  if (!aobMatch) throw new Error("CT_EVENT_FLAG_PATTERN_NOT_FOUND");

  const actions = {};
  for (const [action, groupId] of Object.entries(MAP_GROUP_IDS)) {
    const matches = entries.filter(node => node.id === groupId);
    if (matches.length !== 1) throw new Error(`CT_MAP_GROUP_${groupId}_COUNT_${matches.length}`);
    let operations = parseMapOperations(xml, matches[0]);
    if (action === "dlcMaps") {
      operations = uniqueOperations([...operations, DLC_MAP_LAYER_OPERATION]);
    }
    if (!operations.length) throw new Error(`CT_EVENT_FLAG_GROUP_${groupId}_EMPTY`);
    actions[action] = operations;
  }

  return Object.freeze({
    tablePath,
    tableName: path.basename(tablePath),
    tableVersion: (xml.match(/<CheatTable\s+CheatEngineTableVersion="([^"]+)"/) || [])[1] || null,
    eventFlagPattern: normalizeAobPattern(aobMatch[1]),
    ripOffset: Number(aobMatch[2]),
    ripAdditional: Number(aobMatch[3]),
    actions: Object.freeze(actions)
  });
}

function writeMapManifest(catalog, actions, targetPath) {
  const lines = [
    "EROVERLY_MAPS_V1",
    `PATTERN\t${catalog.eventFlagPattern}`,
    `RIP\t${catalog.ripOffset}\t${catalog.ripAdditional}`
  ];

  for (const action of actions) {
    const operations = catalog.actions[action];
    if (!operations) throw new Error(`UNKNOWN_EVENT_FLAG_ACTION:${action}`);
    lines.push(`ACTION\t${action}`);
    for (const operation of operations) {
      lines.push(`BIT\t${operation.byteOffset}\t${operation.pointerOffset}\t${operation.bit}`);
    }
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  MAP_GROUP_IDS,
  directContent,
  loadMapCatalog,
  normalizeAobPattern,
  parseCheatEntries,
  resolveTablePath,
  writeMapManifest
};
