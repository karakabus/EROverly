const fs = require("fs");
const path = require("path");
const { normalizeAobPattern } = require("./eldenRingMapCatalog");

const DEFAULT_TABLE_NAME = "eldenring_all-in-one_Hexinton-v5.0_ce7.5.ct";
const MAX_ITEM_QUANTITY = 999;
const ITEM_TYPES = Object.freeze([
  Object.freeze({ recordId: 22032400, category: "weapons", typeId: 0 }),
  Object.freeze({ recordId: 22032401, category: "armor", typeId: 1 }),
  Object.freeze({ recordId: 22032402, category: "talismans", typeId: 2 }),
  Object.freeze({ recordId: 22032403, category: "goods", typeId: 4 }),
  Object.freeze({ recordId: 22032404, category: "ashesOfWar", typeId: 8 })
]);

function resolveTablePath(root) {
  const configured = String(process.env.ER_CHEAT_TABLE_PATH || "").trim();
  return path.resolve(configured || path.join(root, DEFAULT_TABLE_NAME));
}

function decodeXmlText(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function searchText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractDropdown(xml, recordId) {
  const recordPattern = new RegExp(
    `<ID>${recordId}<\\/ID>[\\s\\S]*?<DropDownList[^>]*>([\\s\\S]*?)<\\/DropDownList>`
  );
  const matches = [...xml.matchAll(new RegExp(recordPattern.source, "g"))];
  if (matches.length !== 1) throw new Error(`CT_ITEM_DROPDOWN_${recordId}_COUNT_${matches.length}`);
  return matches[0][1];
}

function parseDropdown(xml, definition) {
  const items = [];
  for (const rawLine of extractDropdown(xml, definition.recordId).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error(`CT_ITEM_DROPDOWN_${definition.recordId}_INVALID_LINE`);

    const baseId = Number(line.slice(0, separator));
    const name = decodeXmlText(line.slice(separator + 1).trim());
    if (!Number.isSafeInteger(baseId) || baseId < 0 || baseId > 0x0fffffff || !name) {
      throw new Error(`CT_ITEM_DROPDOWN_${definition.recordId}_INVALID_ITEM`);
    }

    const encodedId = Number((BigInt(definition.typeId) << 28n) | BigInt(baseId));
    items.push(Object.freeze({
      key: `${definition.category}:${baseId}`,
      category: definition.category,
      sourceRecordId: definition.recordId,
      baseId,
      encodedId,
      name,
      searchName: searchText(name)
    }));
  }
  if (!items.length) throw new Error(`CT_ITEM_DROPDOWN_${definition.recordId}_EMPTY`);
  return items;
}

function loadItemCatalog(root) {
  const tablePath = resolveTablePath(root);
  if (!fs.existsSync(tablePath)) throw new Error(`CT_NOT_FOUND:${tablePath}`);
  const xml = fs.readFileSync(tablePath, "utf8");

  const inventoryMatch = xml.match(/aobScanModule\(InventoryAccessor,eldenring\.exe,([^)]+)\)/i);
  const addItemMatch = xml.match(/aobScanModule\(AddItemFunc,eldenring\.exe,([^)]+)\)/i);
  const callContract = /mov\s+rax,InventoryAccessor\+19\s+mov\s+rcx,InventoryAccessor\+1D\s+mov\s+eax,\[rax\]\s+cdqe\s+add\s+rcx,rax\s+mov\s+rcx,\[rcx\][\s\S]*?call\s+AddItemFunc/i;
  if (!inventoryMatch || !addItemMatch || !callContract.test(xml)) {
    throw new Error("CT_ITEM_GIB_CONTRACT_CHANGED");
  }

  const items = ITEM_TYPES.flatMap(definition => parseDropdown(xml, definition));
  const byKey = new Map();
  for (const item of items) {
    if (byKey.has(item.key)) throw new Error(`CT_ITEM_KEY_DUPLICATE:${item.key}`);
    byKey.set(item.key, item);
  }

  return Object.freeze({
    tablePath,
    inventoryPattern: normalizeAobPattern(inventoryMatch[1]),
    inventoryDisplacementOffset: "19",
    inventoryRipAdditional: "1D",
    addItemPattern: normalizeAobPattern(addItemMatch[1]),
    maxQuantity: MAX_ITEM_QUANTITY,
    sourceRecordIds: ITEM_TYPES.map(definition => definition.recordId),
    items: Object.freeze(items),
    byKey
  });
}

function itemRank(item, query, normalizedQuery) {
  const id = String(item.baseId);
  if (id === query) return 0;
  if (item.searchName === normalizedQuery) return 1;
  if (item.searchName.startsWith(normalizedQuery)) return 2;
  if (item.searchName.split(" ").some(word => word.startsWith(normalizedQuery))) return 3;
  if (id.startsWith(query)) return 4;
  return 5;
}

function searchItems(catalog, query, limit = 25) {
  const trimmed = String(query || "").trim().slice(0, 80);
  const normalized = searchText(trimmed);
  if (!normalized) return [];
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 25));

  return catalog.items
    .filter(item => item.searchName.includes(normalized) || String(item.baseId).includes(trimmed))
    .sort((left, right) => {
      const rank = itemRank(left, trimmed, normalized) - itemRank(right, trimmed, normalized);
      return rank || left.name.localeCompare(right.name, "en") || left.baseId - right.baseId;
    })
    .slice(0, safeLimit);
}

function writeItemManifest(catalog, item, quantity, targetPath) {
  if (!catalog.byKey.has(item.key)) throw new Error("UNKNOWN_ITEM");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > catalog.maxQuantity) {
    throw new Error("INVALID_ITEM_QUANTITY");
  }
  const lines = [
    "EROVERLY_ITEM_V1",
    `INVENTORY_PATTERN\t${catalog.inventoryPattern}`,
    `INVENTORY_ACCESSOR\t${catalog.inventoryDisplacementOffset}\t${catalog.inventoryRipAdditional}`,
    `ADD_ITEM_PATTERN\t${catalog.addItemPattern}`,
    `ITEM\t${item.encodedId.toString(16).toUpperCase().padStart(8, "0")}\t${quantity}`
  ];
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  ITEM_TYPES,
  MAX_ITEM_QUANTITY,
  loadItemCatalog,
  searchItems,
  writeItemManifest
};
