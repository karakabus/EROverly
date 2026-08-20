const fs = require("fs");
const path = require("path");

const MAX_HOTKEY_MACROS = 32;
const MAX_KEYS_PER_CHORD = 8;
const MAX_ACTIONS_PER_MACRO = 64;
const MAX_ACTION_DURATION_MS = 60_000;
const MAX_MACRO_DURATION_MS = 120_000;
const HOTKEY_ACTION_TYPES = Object.freeze(["tap", "down", "up", "wait"]);

function keyDefinition(code, en, tr, group, trigger = true) {
  return Object.freeze({ code, label: Object.freeze({ en, tr }), group, trigger });
}

const HOTKEY_CODES = Object.freeze([
  keyDefinition("GameAttack", "Attack", "Saldırı", "game", false),
  keyDefinition("GameStrongAttack", "Strong Attack", "Güçlü Saldırı", "game", false),
  keyDefinition("GameGuard", "Guard", "Savunma", "game", false),
  keyDefinition("GameSkill", "Skill", "Yetenek", "game", false),
  keyDefinition("GameInteract", "Interact / Event Action", "Etkileşim / Olay Eylemi", "game", false),
  keyDefinition("GameSprintDodge", "Sprint / Dodge / Backstep", "Koş / Yuvarlan / Geri Adım", "game", false),
  keyDefinition("GameJump", "Jump", "Zıpla", "game", false),
  keyDefinition("GameUseItem", "Use Item", "Eşya Kullan", "game", false),
  keyDefinition("GameLockOn", "Lock On / Remove Target", "Hedefe Kilitlen / Hedefi Bırak", "game", false),
  keyDefinition("GameCrouch", "Crouch / Stand Up", "Çömel / Ayağa Kalk", "game", false),
  keyDefinition("GameSwitchSpell", "Switch Sorcery / Incantation", "Büyü Değiştir", "game", false),
  keyDefinition("GameSwitchItem", "Switch Item", "Eşya Değiştir", "game", false),
  keyDefinition("GameSwitchRightWeapon", "Switch Right-Hand Armament", "Sağ El Silahını Değiştir", "game", false),
  keyDefinition("GameSwitchLeftWeapon", "Switch Left-Hand Armament", "Sol El Silahını Değiştir", "game", false),
  keyDefinition("GameMoveForward", "Move Forward", "İleri Git", "game", false),
  keyDefinition("GameMoveBackward", "Move Backward", "Geri Git", "game", false),
  keyDefinition("GameMoveLeft", "Move Left", "Sola Git", "game", false),
  keyDefinition("GameMoveRight", "Move Right", "Sağa Git", "game", false),
  keyDefinition("MouseLeft", "Left Mouse Button", "Sol Fare Tuşu", "mouse", false),
  keyDefinition("MouseRight", "Right Mouse Button", "Sağ Fare Tuşu", "mouse", false),
  keyDefinition("MouseMiddle", "Middle Mouse Button", "Orta Fare Tuşu", "mouse", false),
  keyDefinition("MouseX1", "Mouse Button 4", "Fare Tuşu 4", "mouse", false),
  keyDefinition("MouseX2", "Mouse Button 5", "Fare Tuşu 5", "mouse", false),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => keyDefinition(`Key${letter}`, letter, letter, "letters")),
  ..."0123456789".split("").map(number => keyDefinition(`Digit${number}`, number, number, "numbers")),
  ..."0123456789".split("").map(number => keyDefinition(`Numpad${number}`, `Numpad ${number}`, `Numpad ${number}`, "numpad")),
  ...Array.from({ length: 24 }, (_, index) => keyDefinition(`F${index + 1}`, `F${index + 1}`, `F${index + 1}`, "functions")),
  keyDefinition("ArrowUp", "Up Arrow", "Yukarı Ok", "navigation"),
  keyDefinition("ArrowDown", "Down Arrow", "Aşağı Ok", "navigation"),
  keyDefinition("ArrowLeft", "Left Arrow", "Sol Ok", "navigation"),
  keyDefinition("ArrowRight", "Right Arrow", "Sağ Ok", "navigation"),
  keyDefinition("Home", "Home", "Home", "navigation"),
  keyDefinition("End", "End", "End", "navigation"),
  keyDefinition("PageUp", "Page Up", "Page Up", "navigation"),
  keyDefinition("PageDown", "Page Down", "Page Down", "navigation"),
  keyDefinition("Insert", "Insert", "Insert", "navigation"),
  keyDefinition("Delete", "Delete", "Delete", "navigation"),
  keyDefinition("Space", "Space", "Boşluk", "control"),
  keyDefinition("Enter", "Enter", "Enter", "control"),
  keyDefinition("Tab", "Tab", "Tab", "control"),
  keyDefinition("Escape", "Escape", "Escape", "control"),
  keyDefinition("Backspace", "Backspace", "Backspace", "control"),
  keyDefinition("CapsLock", "Caps Lock", "Caps Lock", "control"),
  keyDefinition("ShiftLeft", "Left Shift", "Sol Shift", "modifiers"),
  keyDefinition("ShiftRight", "Right Shift", "Sağ Shift", "modifiers"),
  keyDefinition("ControlLeft", "Left Ctrl", "Sol Ctrl", "modifiers"),
  keyDefinition("ControlRight", "Right Ctrl", "Sağ Ctrl", "modifiers"),
  keyDefinition("AltLeft", "Left Alt", "Sol Alt", "modifiers"),
  keyDefinition("AltRight", "Right Alt", "Sağ Alt", "modifiers"),
  keyDefinition("Pause", "Pause", "Pause", "control"),
  keyDefinition("NumLock", "Num Lock", "Num Lock", "numpad"),
  keyDefinition("ScrollLock", "Scroll Lock", "Scroll Lock", "control"),
  keyDefinition("NumpadMultiply", "Numpad *", "Numpad *", "numpad"),
  keyDefinition("NumpadAdd", "Numpad +", "Numpad +", "numpad"),
  keyDefinition("NumpadSubtract", "Numpad -", "Numpad -", "numpad"),
  keyDefinition("NumpadDecimal", "Numpad .", "Numpad .", "numpad"),
  keyDefinition("NumpadDivide", "Numpad /", "Numpad /", "numpad"),
  keyDefinition("Semicolon", ";", ";", "symbols"),
  keyDefinition("Equal", "=", "=", "symbols"),
  keyDefinition("Comma", ",", ",", "symbols"),
  keyDefinition("Minus", "-", "-", "symbols"),
  keyDefinition("Period", ".", ".", "symbols"),
  keyDefinition("Slash", "/", "/", "symbols"),
  keyDefinition("Backquote", "`", "`", "symbols"),
  keyDefinition("BracketLeft", "[", "[", "symbols"),
  keyDefinition("Backslash", "\\", "\\", "symbols"),
  keyDefinition("BracketRight", "]", "]", "symbols"),
  keyDefinition("Quote", "'", "'", "symbols")
]);

const HOTKEY_CODE_SET = new Set(HOTKEY_CODES.map(key => key.code));
const HOTKEY_TRIGGER_CODE_SET = new Set(HOTKEY_CODES.filter(key => key.trigger).map(key => key.code));

function normalizeChord(value, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_KEYS_PER_CHORD) {
    throw new Error(`INVALID_HOTKEY_${field.toUpperCase()}`);
  }
  const unique = [];
  const seen = new Set();
  for (const code of value) {
    if (typeof code !== "string" || !HOTKEY_TRIGGER_CODE_SET.has(code) || seen.has(code)) {
      throw new Error(`INVALID_HOTKEY_${field.toUpperCase()}`);
    }
    seen.add(code);
    unique.push(code);
  }
  return unique;
}

function normalizeDuration(value, field, fallback) {
  const durationMs = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > MAX_ACTION_DURATION_MS) {
    throw new Error(`INVALID_HOTKEY_${field.toUpperCase()}`);
  }
  return durationMs;
}

function normalizeActions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ACTIONS_PER_MACRO) {
    throw new Error("INVALID_HOTKEY_ACTIONS");
  }

  const heldKeys = new Set();
  let totalDurationMs = 0;
  const actions = value.map((action, index) => {
    const type = typeof action?.type === "string" ? action.type.toLowerCase() : "";
    if (!HOTKEY_ACTION_TYPES.includes(type)) throw new Error(`INVALID_HOTKEY_ACTION_${index}`);

    if (type === "wait") {
      const durationMs = normalizeDuration(action.durationMs, `action_${index}_duration`, 100);
      totalDurationMs += durationMs;
      return { type, durationMs };
    }

    const code = typeof action.code === "string" && HOTKEY_CODE_SET.has(action.code) ? action.code : "";
    if (!code) throw new Error(`INVALID_HOTKEY_ACTION_${index}_KEY`);

    if (type === "tap") {
      if (heldKeys.has(code)) throw new Error("HOTKEY_ACTION_SEQUENCE_INVALID");
      const durationMs = normalizeDuration(action.durationMs, `action_${index}_duration`, 80);
      totalDurationMs += durationMs;
      return { type, code, durationMs };
    }
    if (type === "down") {
      if (heldKeys.has(code)) throw new Error("HOTKEY_ACTION_SEQUENCE_INVALID");
      heldKeys.add(code);
      return { type, code };
    }

    if (!heldKeys.has(code)) throw new Error("HOTKEY_ACTION_SEQUENCE_INVALID");
    heldKeys.delete(code);
    return { type, code };
  });

  if (heldKeys.size) throw new Error("HOTKEY_ACTION_SEQUENCE_INVALID");
  if (totalDurationMs > MAX_MACRO_DURATION_MS) throw new Error("HOTKEY_MACRO_TOO_LONG");
  return actions;
}

function normalizeHotkeyMacros(value) {
  if (!Array.isArray(value) || value.length > MAX_HOTKEY_MACROS) throw new Error("INVALID_HOTKEY_MACROS");
  const ids = new Set();
  const enabledTriggers = new Set();
  return value.map((macro, index) => {
    const id = typeof macro?.id === "string" && /^[A-Za-z0-9-]{1,64}$/.test(macro.id) ? macro.id : "";
    const name = typeof macro?.name === "string" ? macro.name.trim().slice(0, 60) : "";
    if (!id || ids.has(id) || !name) throw new Error(`INVALID_HOTKEY_MACRO_${index}`);
    ids.add(id);
    const trigger = normalizeChord(macro.trigger, "trigger");
    const actions = normalizeActions(macro.actions);
    const enabled = macro.enabled !== false;
    const triggerKey = [...trigger].sort().join("+");
    if (enabled && enabledTriggers.has(triggerKey)) throw new Error("HOTKEY_TRIGGER_CONFLICT");
    if (enabled) enabledTriggers.add(triggerKey);
    return { id, name, enabled, trigger, actions };
  });
}

function readHotkeyConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) return { serviceEnabled: false, macros: [] };
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      serviceEnabled: parsed.serviceEnabled === true,
      macros: normalizeHotkeyMacros(parsed.macros || [])
    };
  } catch (_) {
    return { serviceEnabled: false, macros: [] };
  }
}

function writeHotkeyConfig(configPath, config) {
  const normalized = {
    serviceEnabled: config.serviceEnabled === true,
    macros: normalizeHotkeyMacros(config.macros || [])
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(temporaryPath, configPath);
  return normalized;
}

function writeHotkeyManifest(manifestPath, macros) {
  const normalized = normalizeHotkeyMacros(macros || []);
  const enabled = normalized.filter(macro => macro.enabled);
  if (!enabled.length) throw new Error("NO_ENABLED_HOTKEY_MACROS");
  const lines = [
    "EROVERLY_HOTKEYS_V2"
  ];
  for (const macro of enabled) {
    lines.push(`MACRO\t${macro.id}\t${macro.trigger.join(",")}`);
    for (const action of macro.actions) {
      const code = action.code || "-";
      const durationMs = action.durationMs || 0;
      lines.push(`ACTION\t${action.type.toUpperCase()}\t${code}\t${durationMs}`);
    }
    lines.push("END");
  }
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${lines.join("\n")}\n`, "utf8");
}

module.exports = {
  HOTKEY_CODES,
  HOTKEY_ACTION_TYPES,
  MAX_HOTKEY_MACROS,
  MAX_KEYS_PER_CHORD,
  MAX_ACTIONS_PER_MACRO,
  MAX_ACTION_DURATION_MS,
  normalizeHotkeyMacros,
  readHotkeyConfig,
  writeHotkeyConfig,
  writeHotkeyManifest
};
