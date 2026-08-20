(function initHotkeysPage() {
  "use strict";

  const COPY = {
    en: {
      title: "Hotkey Program",
      intro: "Build your own trigger chords and timed keyboard action sequences for Elden Ring.",
      requirement: "The service listens only while Elden Ring is the foreground app and Easy Anti-Cheat is disabled. The last key recorded in the trigger is the activation key and is consumed by the service.",
      service: "Hotkey service",
      unavailable: "The hotkey helper is not available.",
      stopped: "Stopped",
      starting: "Starting...",
      running: "Running — waiting for Elden Ring hotkeys",
      stopping: "Stopping...",
      error: "Service error",
      start: "Start Service",
      stop: "Stop Service",
      macros: "Macro records",
      add: "Add Macro",
      save: "Save Changes",
      saved: "Macro records saved.",
      saveFirst: "Save the changes before starting the service.",
      empty: "No macro record yet. Add one to begin.",
      macroName: "Macro name",
      macroNamePlaceholder: "Example: Quick mount",
      enabled: "Enabled",
      trigger: "Trigger chord",
      recordTrigger: "Record trigger",
      recording: "Press the desired keys, then release them...",
      cancelRecording: "Cancel recording",
      actions: "Action sequence",
      actionHint: "Actions run from top to bottom.",
      addTap: "Tap Key",
      addDown: "Key Down",
      addUp: "Key Up",
      addWait: "Wait",
      tap: "Tap",
      down: "Hold down",
      up: "Release",
      waitAction: "Wait",
      key: "Key",
      duration: "Duration",
      milliseconds: "ms",
      groupGame: "Game actions — default PC bindings",
      groupMouse: "Mouse buttons",
      groupLetters: "Letters",
      groupNumbers: "Numbers",
      groupNumpad: "Numpad",
      groupFunctions: "Function keys",
      groupNavigation: "Navigation",
      groupControl: "Control keys",
      groupModifiers: "Modifier keys",
      groupSymbols: "Symbols",
      moveUp: "Move up",
      moveDown: "Move down",
      removeAction: "Delete step",
      remove: "Delete Macro",
      invalid: "Every macro needs a name, trigger, and at least one valid action.",
      invalidSequence: "Every Hold down step must have a later matching Release step. A held key cannot be tapped or held again.",
      conflict: "Two enabled macros cannot use the same trigger.",
      noEnabled: "Enable at least one saved macro.",
      unsupported: code => `${code} is not supported.`,
      requestFailed: "The hotkey request failed.",
      lastTriggered: name => `Last triggered: ${name}`,
      dirty: "Unsaved changes",
      ready: "Saved",
      sequenceHint: "Example: trigger 1 → Hold Interact → Tap Switch Spell → Release Interact. Named game actions use Elden Ring's default PC bindings; raw keys and mouse buttons remain available. Each macro can be enabled or disabled separately."
    },
    tr: {
      title: "Hotkey Programı",
      intro: "Elden Ring için istediğin tetikleyici kombinasyonunu ve zamanlamalı tuş eylemlerini oluştur.",
      requirement: "Servis yalnızca Elden Ring ön plandayken ve Easy Anti-Cheat kapalıyken çalışır. Tetikleyicide en son kaydedilen tuş çalıştırma tuşudur ve servis tarafından tutulur.",
      service: "Hotkey servisi",
      unavailable: "Hotkey yardımcısı hazır değil.",
      stopped: "Durduruldu",
      starting: "Başlatılıyor...",
      running: "Çalışıyor — Elden Ring hotkey'leri bekleniyor",
      stopping: "Durduruluyor...",
      error: "Servis hatası",
      start: "Servisi Başlat",
      stop: "Servisi Durdur",
      macros: "Makro kayıtları",
      add: "Makro Ekle",
      save: "Değişiklikleri Kaydet",
      saved: "Makro kayıtları kaydedildi.",
      saveFirst: "Servisi başlatmadan önce değişiklikleri kaydet.",
      empty: "Henüz makro kaydı yok. Başlamak için yeni kayıt ekle.",
      macroName: "Makro adı",
      macroNamePlaceholder: "Örnek: Hızlı at çağır",
      enabled: "Aktif",
      trigger: "Tetikleyici kombinasyonu",
      recordTrigger: "Tetikleyiciyi Kaydet",
      recording: "İstediğin tuşlara bas, sonra hepsini bırak...",
      cancelRecording: "Kaydı İptal Et",
      actions: "Eylem sırası",
      actionHint: "Eylemler yukarıdan aşağıya çalışır.",
      addTap: "Tuşa Bas",
      addDown: "Basılı Tut",
      addUp: "Tuşu Bırak",
      addWait: "Bekle",
      tap: "Bas",
      down: "Basılı tut",
      up: "Bırak",
      waitAction: "Bekle",
      key: "Tuş",
      duration: "Süre",
      milliseconds: "ms",
      groupGame: "Oyun eylemleri — varsayılan PC tuşları",
      groupMouse: "Fare tuşları",
      groupLetters: "Harfler",
      groupNumbers: "Rakamlar",
      groupNumpad: "Numpad",
      groupFunctions: "Fonksiyon tuşları",
      groupNavigation: "Yön ve gezinme",
      groupControl: "Kontrol tuşları",
      groupModifiers: "Değiştirici tuşlar",
      groupSymbols: "Semboller",
      moveUp: "Yukarı taşı",
      moveDown: "Aşağı taşı",
      removeAction: "Adımı sil",
      remove: "Makroyu Sil",
      invalid: "Her makroda ad, tetikleyici ve en az bir geçerli eylem bulunmalı.",
      invalidSequence: "Her Basılı tut adımının ileride eşleşen bir Bırak adımı olmalı. Basılı bir tuşa yeniden basılamaz.",
      conflict: "İki aktif makro aynı tetikleyiciyi kullanamaz.",
      noEnabled: "En az bir kayıtlı makroyu aktif et.",
      unsupported: code => `${code} tuşu desteklenmiyor.`,
      requestFailed: "Hotkey isteği gönderilemedi.",
      lastTriggered: name => `Son çalışan: ${name}`,
      dirty: "Kaydedilmemiş değişiklikler",
      ready: "Kaydedildi",
      sequenceHint: "Örnek: tetikleyici 1 → Etkileşim'i basılı tut → Büyü Değiştir'e bas → Etkileşim'i bırak. İsimli oyun eylemleri Elden Ring'in varsayılan PC tuşlarını kullanır; ham klavye ve fare tuşları da seçilebilir. Her makro ayrı ayrı aktif veya pasif yapılabilir."
    }
  };

  const root = document.getElementById("hotkeyRoot");
  const languageSelect = document.getElementById("languageSelect");
  let supportedKeys = [];
  let keyByCode = new Map();
  let macros = [];
  let service = { state: "stopped" };
  let serviceEnabled = false;
  let available = { ready: false, code: null };
  let loaded = false;
  let dirty = false;
  let busy = false;
  let statusMessage = "";
  let statusType = "";
  let recording = null;
  let pollTimer = null;

  if (!root) return;

  function language() {
    return languageSelect?.value === "en" ? "en" : "tr";
  }

  function t(key) {
    return COPY[language()][key];
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function keyLabel(code) {
    const definition = keyByCode.get(code);
    return definition?.label?.[language()] || definition?.label?.en || code;
  }

  function chordMarkup(codes) {
    if (!codes?.length) return '<span class="hotkey-empty-chord">—</span>';
    return codes.map(code => `<kbd>${escapeHtml(keyLabel(code))}</kbd>`).join('<span class="hotkey-plus">+</span>');
  }

  function keyOptions(selected) {
    const groupOrder = ["game", "mouse", "letters", "numbers", "numpad", "functions", "navigation", "control", "modifiers", "symbols"];
    const grouped = new Map(groupOrder.map(group => [group, []]));
    for (const key of supportedKeys) {
      if (!grouped.has(key.group)) grouped.set(key.group, []);
      grouped.get(key.group).push(key);
    }
    return [...grouped.entries()].filter(([, keys]) => keys.length).map(([group, keys]) => {
      const titleKey = `group${group.charAt(0).toUpperCase()}${group.slice(1)}`;
      const options = keys.map(key => {
        const label = key.label?.[language()] || key.label?.en || key.code;
        return `<option value="${escapeHtml(key.code)}" ${key.code === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
      }).join("");
      return `<optgroup label="${escapeHtml(t(titleKey) || group)}">${options}</optgroup>`;
    }).join("");
  }

  function actionTypeOptions(selected) {
    return ["tap", "down", "up", "wait"].map(type => {
      const label = type === "wait" ? t("waitAction") : t(type);
      return `<option value="${type}" ${type === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function validation() {
    const triggers = new Set();
    for (const macro of macros) {
      if (!macro.name.trim() || !macro.trigger.length || !macro.actions.length) return { valid: false, message: t("invalid") };
      const triggerKey = [...macro.trigger].sort().join("+");
      if (macro.enabled && triggers.has(triggerKey)) return { valid: false, message: t("conflict") };
      if (macro.enabled) triggers.add(triggerKey);

      const held = new Set();
      let totalDuration = 0;
      for (const action of macro.actions) {
        if (!["tap", "down", "up", "wait"].includes(action.type)) return { valid: false, message: t("invalid") };
        if (action.type === "wait") {
          if (!Number.isInteger(action.durationMs) || action.durationMs < 1 || action.durationMs > 60000) return { valid: false, message: t("invalid") };
          totalDuration += action.durationMs;
          continue;
        }
        if (!keyByCode.has(action.code)) return { valid: false, message: t("invalid") };
        if (action.type === "tap") {
          if (held.has(action.code) || !Number.isInteger(action.durationMs) || action.durationMs < 1 || action.durationMs > 60000) return { valid: false, message: t("invalidSequence") };
          totalDuration += action.durationMs;
        } else if (action.type === "down") {
          if (held.has(action.code)) return { valid: false, message: t("invalidSequence") };
          held.add(action.code);
        } else {
          if (!held.has(action.code)) return { valid: false, message: t("invalidSequence") };
          held.delete(action.code);
        }
      }
      if (held.size || totalDuration > 120000) return { valid: false, message: t("invalidSequence") };
    }
    return { valid: true, message: "" };
  }

  function serviceStateCopy() {
    if (!available.ready) return t("unavailable");
    return t(["starting", "running", "stopping", "error"].includes(service.state) ? service.state : "stopped");
  }

  function lastTriggeredCopy() {
    if (!service.lastTriggeredMacroId) return "";
    const macro = macros.find(item => item.id === service.lastTriggeredMacroId);
    return t("lastTriggered")(macro?.name || service.lastTriggeredMacroId);
  }

  function actionMarkup(action, macroIndex, actionIndex, actionCount) {
    const usesKey = action.type !== "wait";
    const usesDuration = action.type === "tap" || action.type === "wait";
    return `
      <div class="hotkey-action-row" data-action-row="${actionIndex}">
        <span class="hotkey-step-number">${actionIndex + 1}</span>
        <label>
          <span class="sr-only">${escapeHtml(t("actions"))}</span>
          <select data-role="action-type" data-index="${macroIndex}" data-action-index="${actionIndex}">${actionTypeOptions(action.type)}</select>
        </label>
        ${usesKey ? `
          <label class="hotkey-action-key">
            <span class="sr-only">${escapeHtml(t("key"))}</span>
            <select data-role="action-code" data-index="${macroIndex}" data-action-index="${actionIndex}">${keyOptions(action.code)}</select>
          </label>
        ` : '<div class="hotkey-action-spacer"></div>'}
        ${usesDuration ? `
          <label class="hotkey-duration-field">
            <input type="number" min="1" max="60000" step="1" data-role="action-duration" data-index="${macroIndex}" data-action-index="${actionIndex}" value="${escapeHtml(action.durationMs)}" aria-label="${escapeHtml(t("duration"))}">
            <span>${escapeHtml(t("milliseconds"))}</span>
          </label>
        ` : '<div class="hotkey-action-spacer"></div>'}
        <div class="hotkey-action-controls">
          <button type="button" data-action="move-action-up" data-index="${macroIndex}" data-action-index="${actionIndex}" title="${escapeHtml(t("moveUp"))}" ${actionIndex === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-action="move-action-down" data-index="${macroIndex}" data-action-index="${actionIndex}" title="${escapeHtml(t("moveDown"))}" ${actionIndex === actionCount - 1 ? "disabled" : ""}>↓</button>
          <button class="danger" type="button" data-action="remove-action" data-index="${macroIndex}" data-action-index="${actionIndex}" title="${escapeHtml(t("removeAction"))}">×</button>
        </div>
      </div>
    `;
  }

  function macroMarkup(macro, index) {
    const triggerRecording = recording?.macroId === macro.id;
    return `
      <article class="hotkey-card ${macro.enabled ? "is-enabled" : ""}">
        <div class="hotkey-card-head">
          <label class="hotkey-name-field">
            <span>${escapeHtml(t("macroName"))}</span>
            <input type="text" maxlength="60" data-role="macro-name" data-index="${index}" value="${escapeHtml(macro.name)}" placeholder="${escapeHtml(t("macroNamePlaceholder"))}">
          </label>
          <label class="switch-row hotkey-enabled-switch">
            <input type="checkbox" data-role="macro-enabled" data-index="${index}" ${macro.enabled ? "checked" : ""}>
            <span class="switch-track" aria-hidden="true"></span>
            <span>${escapeHtml(t("enabled"))}</span>
          </label>
          <button class="danger" type="button" data-action="remove-macro" data-index="${index}">${escapeHtml(t("remove"))}</button>
        </div>
        <div class="hotkey-trigger-editor">
          <div>
            <strong>${escapeHtml(t("trigger"))}</strong>
            <div class="hotkey-chord" data-chord="trigger" data-index="${index}">${chordMarkup(triggerRecording ? recording.codes : macro.trigger)}</div>
          </div>
          <button type="button" data-action="record-trigger" data-index="${index}">${escapeHtml(triggerRecording ? t("cancelRecording") : t("recordTrigger"))}</button>
        </div>
        ${triggerRecording ? `<div class="hotkey-recording"><span></span>${escapeHtml(t("recording"))}</div>` : ""}
        <section class="hotkey-actions-editor">
          <div class="hotkey-actions-header">
            <div><strong>${escapeHtml(t("actions"))}</strong><small>${escapeHtml(t("actionHint"))}</small></div>
            <span>${macro.actions.length}/64</span>
          </div>
          <div class="hotkey-action-list">
            ${macro.actions.length ? macro.actions.map((action, actionIndex) => actionMarkup(action, index, actionIndex, macro.actions.length)).join("") : `<div class="hotkey-action-empty">${escapeHtml(t("invalid"))}</div>`}
          </div>
          <div class="hotkey-action-adders">
            <button type="button" data-action="add-action" data-action-type="tap" data-index="${index}">+ ${escapeHtml(t("addTap"))}</button>
            <button type="button" data-action="add-action" data-action-type="down" data-index="${index}">+ ${escapeHtml(t("addDown"))}</button>
            <button type="button" data-action="add-action" data-action-type="up" data-index="${index}">+ ${escapeHtml(t("addUp"))}</button>
            <button type="button" data-action="add-action" data-action-type="wait" data-index="${index}">+ ${escapeHtml(t("addWait"))}</button>
          </div>
        </section>
      </article>
    `;
  }

  function render() {
    const check = validation();
    const hasEnabled = macros.some(macro => macro.enabled);
    const serviceTransitioning = service.state === "starting" || service.state === "stopping";
    root.innerHTML = `
      <section class="hotkey-page" aria-labelledby="hotkeyTitle">
        <header class="hotkey-header">
          <div>
            <div class="cheat-automation-kicker">EROVERLY</div>
            <h1 id="hotkeyTitle">${escapeHtml(t("title"))}</h1>
            <p>${escapeHtml(t("intro"))}</p>
          </div>
        </header>
        <div class="hotkey-warning">${escapeHtml(t("requirement"))}</div>
        <section class="hotkey-service-card">
          <div>
            <span>${escapeHtml(t("service"))}</span>
            <strong class="hotkey-service-state is-${escapeHtml(service.state || "stopped")}">${escapeHtml(serviceStateCopy())}</strong>
            <code class="hotkey-service-code">${escapeHtml(service.code || "")}</code>
            <small class="hotkey-last-triggered">${escapeHtml(lastTriggeredCopy())}</small>
          </div>
          <button class="${serviceEnabled ? "danger" : "primary"}" type="button" data-action="toggle-service" ${busy || serviceTransitioning || !available.ready || (!serviceEnabled && (dirty || !hasEnabled)) ? "disabled" : ""}>
            ${escapeHtml(serviceEnabled ? t("stop") : t("start"))}
          </button>
        </section>
        <div class="hotkey-hint">${escapeHtml(t("sequenceHint"))}</div>
        <section class="hotkey-list-section">
          <div class="hotkey-list-header">
            <div>
              <h2>${escapeHtml(t("macros"))}</h2>
              <span class="hotkey-dirty ${dirty ? "is-dirty" : ""}">${escapeHtml(dirty ? t("dirty") : t("ready"))}</span>
            </div>
            <button type="button" data-action="add-macro">+ ${escapeHtml(t("add"))}</button>
          </div>
          <div class="hotkey-list">
            ${macros.length ? macros.map(macroMarkup).join("") : `<div class="hotkey-empty">${escapeHtml(t("empty"))}</div>`}
          </div>
        </section>
        <footer class="hotkey-footer">
          <span id="hotkeyStatus" class="field-hint ${statusType ? `is-${statusType}` : ""}" role="status" aria-live="polite">${escapeHtml(statusMessage || (!check.valid ? check.message : ""))}</span>
          <button class="primary" type="button" data-action="save" ${busy || !dirty || !check.valid || Boolean(recording) ? "disabled" : ""}>${escapeHtml(t("save"))}</button>
        </footer>
      </section>
    `;
  }

  function updateControls() {
    const check = validation();
    const status = document.getElementById("hotkeyStatus");
    if (status) {
      status.textContent = statusMessage || (!check.valid ? check.message : "");
      status.className = `field-hint ${statusType ? `is-${statusType}` : ""}`;
    }
    const dirtyNode = root.querySelector(".hotkey-dirty");
    if (dirtyNode) {
      dirtyNode.textContent = dirty ? t("dirty") : t("ready");
      dirtyNode.classList.toggle("is-dirty", dirty);
    }
    const saveButton = root.querySelector('[data-action="save"]');
    if (saveButton) saveButton.disabled = busy || !dirty || !check.valid || Boolean(recording);
    const serviceButton = root.querySelector('[data-action="toggle-service"]');
    if (serviceButton) serviceButton.disabled = busy || !available.ready || (!serviceEnabled && (dirty || !macros.some(macro => macro.enabled)));
  }

  function updateServiceView() {
    const stateNode = root.querySelector(".hotkey-service-state");
    if (stateNode) {
      stateNode.textContent = serviceStateCopy();
      stateNode.className = `hotkey-service-state is-${service.state || "stopped"}`;
    }
    const codeNode = root.querySelector(".hotkey-service-code");
    if (codeNode) codeNode.textContent = service.code || "";
    const lastNode = root.querySelector(".hotkey-last-triggered");
    if (lastNode) lastNode.textContent = lastTriggeredCopy();
    updateControls();
  }

  function setStatus(message, type) {
    statusMessage = message;
    statusType = type || "";
    updateControls();
  }

  function markDirty() {
    dirty = true;
    statusMessage = "";
    statusType = "";
    updateControls();
  }

  async function loadState(initial) {
    try {
      const response = await fetch("/api/hotkeys", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code || "HOTKEY_LOAD_FAILED");
      supportedKeys = Array.isArray(result.supportedKeys) ? result.supportedKeys : supportedKeys;
      keyByCode = new Map(supportedKeys.map(key => [key.code, key]));
      service = result.service || service;
      serviceEnabled = Boolean(result.serviceEnabled);
      available = result.available || available;
      if (initial) {
        macros = Array.isArray(result.macros) ? result.macros : [];
        loaded = true;
        render();
      } else {
        updateServiceView();
      }
    } catch (_) {
      available = { ready: false, code: "HOTKEY_API_UNAVAILABLE" };
      if (!loaded) render();
      else updateServiceView();
    }
  }

  async function saveMacros() {
    const check = validation();
    if (!check.valid) {
      setStatus(check.message, "error");
      return;
    }
    busy = true;
    render();
    try {
      const response = await fetch("/api/hotkeys/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ macros })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code || "HOTKEY_SAVE_FAILED");
      macros = result.macros;
      service = result.service;
      serviceEnabled = Boolean(result.serviceEnabled);
      available = result.available;
      dirty = false;
      statusMessage = t("saved");
      statusType = "done";
    } catch (error) {
      const code = String(error.message || error);
      statusMessage = code === "HOTKEY_TRIGGER_CONFLICT" ? t("conflict") : code === "HOTKEY_ACTION_SEQUENCE_INVALID" ? t("invalidSequence") : t("requestFailed");
      statusType = "error";
    } finally {
      busy = false;
      render();
    }
  }

  async function toggleService() {
    if (!serviceEnabled && dirty) {
      setStatus(t("saveFirst"), "error");
      return;
    }
    if (!serviceEnabled && !macros.some(macro => macro.enabled)) {
      setStatus(t("noEnabled"), "error");
      return;
    }
    busy = true;
    render();
    try {
      const response = await fetch("/api/hotkeys/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !serviceEnabled })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code || "HOTKEY_SERVICE_FAILED");
      service = result.service;
      serviceEnabled = Boolean(result.serviceEnabled);
      available = result.available;
      statusMessage = "";
      statusType = "";
    } catch (error) {
      statusMessage = String(error.message || error) === "NO_ENABLED_HOTKEY_MACROS" ? t("noEnabled") : t("requestFailed");
      statusType = "error";
    } finally {
      busy = false;
      render();
    }
  }

  function addMacro() {
    if (macros.length >= 32) return;
    macros.push({ id: crypto.randomUUID(), name: "", enabled: true, trigger: [], actions: [] });
    markDirty();
    render();
    root.querySelector(`input[data-role="macro-name"][data-index="${macros.length - 1}"]`)?.focus();
  }

  function addAction(macroIndex, type) {
    const macro = macros[macroIndex];
    if (!macro || macro.actions.length >= 64 || !["tap", "down", "up", "wait"].includes(type)) return;
    const firstCode = supportedKeys[0]?.code || "KeyA";
    if (type === "wait") macro.actions.push({ type, durationMs: 100 });
    else if (type === "tap") macro.actions.push({ type, code: firstCode, durationMs: 80 });
    else macro.actions.push({ type, code: firstCode });
    markDirty();
    render();
  }

  function startRecording(index) {
    const macro = macros[index];
    if (!macro) return;
    if (recording?.macroId === macro.id) {
      recording = null;
      render();
      return;
    }
    recording = { macroId: macro.id, codes: [], held: new Set() };
    setStatus("", "");
    render();
  }

  function updateRecordingChord() {
    if (!recording) return;
    const index = macros.findIndex(macro => macro.id === recording.macroId);
    const node = root.querySelector(`[data-chord="trigger"][data-index="${index}"]`);
    if (node) node.innerHTML = chordMarkup(recording.codes);
  }

  window.addEventListener("keydown", event => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (!keyByCode.has(event.code)) {
      setStatus(t("unsupported")(event.code || event.key), "error");
      return;
    }
    recording.held.add(event.code);
    if (!recording.codes.includes(event.code) && recording.codes.length < 8) recording.codes.push(event.code);
    updateRecordingChord();
  }, true);

  window.addEventListener("keyup", event => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    recording.held.delete(event.code);
    if (recording.held.size || !recording.codes.length) return;
    const macro = macros.find(item => item.id === recording.macroId);
    if (macro) macro.trigger = [...recording.codes];
    recording = null;
    dirty = true;
    statusMessage = "";
    statusType = "";
    render();
  }, true);

  root.addEventListener("input", event => {
    const macro = macros[Number(event.target.dataset.index)];
    if (!macro) return;
    if (event.target.matches('input[data-role="macro-name"]')) macro.name = event.target.value;
    else if (event.target.matches('input[data-role="action-duration"]')) {
      const action = macro.actions[Number(event.target.dataset.actionIndex)];
      if (!action) return;
      action.durationMs = Number(event.target.value);
    } else return;
    markDirty();
  });

  root.addEventListener("change", event => {
    const macro = macros[Number(event.target.dataset.index)];
    if (!macro) return;
    if (event.target.matches('input[data-role="macro-enabled"]')) macro.enabled = event.target.checked;
    else if (event.target.matches('select[data-role="action-code"]')) {
      const action = macro.actions[Number(event.target.dataset.actionIndex)];
      if (!action) return;
      action.code = event.target.value;
    } else if (event.target.matches('select[data-role="action-type"]')) {
      const actionIndex = Number(event.target.dataset.actionIndex);
      const type = event.target.value;
      const firstCode = supportedKeys[0]?.code || "KeyA";
      if (type === "wait") macro.actions[actionIndex] = { type, durationMs: 100 };
      else if (type === "tap") macro.actions[actionIndex] = { type, code: macro.actions[actionIndex]?.code || firstCode, durationMs: 80 };
      else macro.actions[actionIndex] = { type, code: macro.actions[actionIndex]?.code || firstCode };
    } else return;
    dirty = true;
    statusMessage = "";
    statusType = "";
    render();
  });

  root.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const actionIndex = Number(button.dataset.actionIndex);
    const macro = macros[index];
    switch (button.dataset.action) {
      case "add-macro": addMacro(); break;
      case "remove-macro":
        if (!macro) break;
        if (recording?.macroId === macro.id) recording = null;
        macros.splice(index, 1);
        dirty = true;
        render();
        break;
      case "record-trigger": startRecording(index); break;
      case "add-action": addAction(index, button.dataset.actionType); break;
      case "remove-action":
        if (!macro?.actions[actionIndex]) break;
        macro.actions.splice(actionIndex, 1);
        dirty = true;
        render();
        break;
      case "move-action-up":
      case "move-action-down": {
        if (!macro?.actions[actionIndex]) break;
        const target = button.dataset.action === "move-action-up" ? actionIndex - 1 : actionIndex + 1;
        if (target < 0 || target >= macro.actions.length) break;
        [macro.actions[actionIndex], macro.actions[target]] = [macro.actions[target], macro.actions[actionIndex]];
        dirty = true;
        render();
        break;
      }
      case "save": saveMacros(); break;
      case "toggle-service": toggleService(); break;
    }
  });

  languageSelect?.addEventListener("change", render);
  render();
  loadState(true);
  pollTimer = setInterval(() => loadState(false), 1000);
  window.addEventListener("beforeunload", () => clearInterval(pollTimer));
})();
