(function initCheatAutomations() {
  "use strict";

  const AUTOMATIONS = [
    {
      id: "mainGameMaps",
      sourceGroupId: 1337314851,
      group: "maps",
      selected: true,
      title: { en: "Main game maps", tr: "Ana oyun haritaları" },
      description: {
        en: "Marks all main-game map fragments as acquired in the running game.",
        tr: "Çalışan oyunda tüm ana oyun harita parçalarını alınmış olarak işaretler."
      }
    },
    {
      id: "dlcMaps",
      sourceGroupId: 1337314637,
      group: "maps",
      selected: true,
      title: { en: "DLC maps", tr: "DLC haritaları" },
      description: {
        en: "Shows the Shadow Realm map layer and marks all DLC map fragments as acquired.",
        tr: "Gölge Diyarı harita katmanını gösterir ve tüm DLC harita parçalarını alınmış olarak işaretler."
      }
    },
    {
      id: "mainGameGraces",
      sourceGroupId: 1337309323,
      group: "graces",
      selected: false,
      title: { en: "Main game Sites of Grace", tr: "Ana oyun Lütuf Noktaları" },
      description: {
        en: "Marks all main-game Sites of Grace as discovered in the running game.",
        tr: "Çalışan oyunda tüm ana oyun Lütuf Noktalarını keşfedilmiş olarak işaretler."
      }
    },
    {
      id: "dlcGraces",
      sourceGroupId: 1337314835,
      group: "graces",
      selected: false,
      title: { en: "DLC Sites of Grace", tr: "DLC Lütuf Noktaları" },
      description: {
        en: "Marks all Shadow of the Erdtree Sites of Grace as discovered in the running game.",
        tr: "Çalışan oyunda tüm Shadow of the Erdtree Lütuf Noktalarını keşfedilmiş olarak işaretler."
      }
    }
  ];

  const ITEM_CATEGORY_COPY = {
    en: {
      weapons: "Weapon / shield",
      armor: "Armor",
      talismans: "Talisman",
      goods: "Magic / goods",
      ashesOfWar: "Ash of War"
    },
    tr: {
      weapons: "Silah / kalkan",
      armor: "Zırh",
      talismans: "Tılsım",
      goods: "Büyü / eşya",
      ashesOfWar: "Ash of War"
    }
  };

  const CHARACTER_STAT_COPY = {
    en: {
      level: "Level",
      vigor: "Vigor",
      mind: "Mind",
      endurance: "Endurance",
      strength: "Strength",
      dexterity: "Dexterity",
      intelligence: "Intelligence",
      faith: "Faith",
      arcane: "Arcane"
    },
    tr: {
      level: "Level",
      vigor: "Canlılık (Vigor)",
      mind: "Zihin (Mind)",
      endurance: "Dayanıklılık (Endurance)",
      strength: "Güç (Strength)",
      dexterity: "Çeviklik (Dexterity)",
      intelligence: "Zekâ (Intelligence)",
      faith: "İnanç (Faith)",
      arcane: "Gizem (Arcane)"
    }
  };

  const COPY = {
    en: {
      label: "Game helper",
      open: "Open Automations",
      hint: "Apply the allowed map, Site of Grace, rune, item, boss, character, and invincibility commands directly to the running game; Cheat Engine is not required.",
      title: "Elden Ring Automations",
      intro: "Apply map or Site of Grace groups, add runes, or search the Hexinton catalog and add an item to the running game.",
      requirement: "Cheat Engine is not required. Elden Ring must be running offline with Easy Anti-Cheat disabled. The helper reads only the allowed map, Site of Grace, Add Runes, ItemGib, boss-state, character-stat, and invincibility contracts from the Hexinton table; no other CT scripts are executed.",
      maps: "Maps",
      graces: "Sites of Grace",
      runes: "Runes",
      runeAmount: "Amount to add",
      runeHint: "Adds runes through the game's own AddSoul function. The final held amount cannot exceed 999,999,999.",
      addRunes: "Add Runes",
      items: "Items",
      itemSearch: "Item lookup",
      itemSearchPlaceholder: "Search by item name or CT ID...",
      itemSearchHint: "Searches weapons, armor, talismans, magic/goods, and Ashes of War from the Hexinton ItemGib lists.",
      itemQuantity: "Quantity to add",
      itemQuantityInvalid: "Enter a whole-number item quantity between 1 and 999.",
      itemRequired: "Choose one item from the lookup results.",
      itemSearchEmpty: "No matching item was found.",
      itemSearchPrompt: "Type an item name or CT ID to search.",
      itemSearching: "Searching items...",
      addItem: "Add Item",
      addingItem: "Adding item...",
      itemAdded: (name, quantity) => `${quantity} × ${name} added.`,
      bosses: "Boss management",
      bossHint: "Read the current alive/dead state from the running game, select multiple bosses, and apply the changes together.",
      openBosses: "Open Boss List",
      bossTitle: "Boss States",
      bossIntro: "Current states are captured when this window opens. Check any number of bosses and choose their new state.",
      bossSearch: "Search bosses",
      bossSearchPlaceholder: "Boss, location, or region...",
      bossFilterAll: "All",
      bossFilterMain: "Main game",
      bossFilterDlc: "DLC",
      bossCurrent: "Current",
      bossAlive: "Alive",
      bossDead: "Dead",
      bossUnknown: "Unknown",
      bossTarget: "New state",
      bossRefresh: "Refresh state",
      bossRefreshing: "Reading current boss states...",
      bossLiveState: "Current states read from live game memory.",
      bossSaveState: "Live memory was unavailable; current states are from the latest readable save snapshot.",
      bossStateUnavailable: "Current boss states could not be read. Load a character and refresh.",
      bossNoResults: "No bosses match this filter.",
      bossSelected: count => `${count} boss changes selected`,
      bossChooseOne: "Select at least one boss change.",
      bossApply: "Apply Boss Changes",
      bossApplying: "Applying selected boss states...",
      bossApplied: count => `${count} boss state changes were applied.`,
      bossSetSelectedAlive: "Set selected alive",
      bossSetSelectedDead: "Set selected dead",
      bossTargetConflict: "Some selected bosses share state flags and cannot be assigned opposite states in one batch. Apply those bosses separately.",
      characterStats: "Character stats",
      characterStatsHint: "Read and change the current rune level and eight base attributes.",
      openCharacterStats: "Open Character Stats",
      characterStatsTitle: "Character Stats",
      characterStatsIntro: "Current values are read from the loaded character. Level is recalculated automatically from the total attribute change.",
      characterStatsWarning: "Attributes are written first and the calculated Level is written last. A save backup is recommended.",
      characterStatsAuto: "Automatic",
      characterStatsRefresh: "Refresh values",
      characterStatsRefreshing: "Reading current character stats...",
      characterStatsLive: "Current values read from live game memory.",
      characterStatsUnavailable: "Character stats could not be read. Load a character and refresh.",
      characterStatsCurrent: "Current",
      characterStatsChanges: count => `${count} stat changes`,
      characterStatsInvalid: "Enter whole numbers within the indicated ranges.",
      characterStatsChooseOne: "Change at least one value.",
      characterStatsReset: "Reset changes",
      characterStatsApply: "Apply Stat Changes",
      characterStatsApplying: "Applying character stat changes...",
      characterStatsApplied: count => `${count} character stat changes were applied.`,
      invincibility: "Invincibility",
      invincibilityHint: "Read and change the current session's player and global enemy death-prevention flags.",
      playerImmortal: "Player cannot die",
      playerImmortalHint: "Enables Hexinton NoDead for the player. Damage is still received, but the character cannot die.",
      bossesImmortal: "Bosses cannot die",
      bossesImmortalHint: "Uses Hexinton All No Dead. It affects every boss, enemy, and NPC—not only the active boss.",
      invincibilitySessionOnly: "These flags affect only the running game session and reset when the game closes.",
      invincibilityCurrent: "Current",
      invincibilityOn: "On",
      invincibilityOff: "Off",
      invincibilityRefresh: "Refresh State",
      invincibilityLoading: "Reading invincibility states...",
      invincibilityLive: "Current states read from live game memory.",
      invincibilityUnavailable: "Invincibility states could not be read. Start the game offline and refresh.",
      invincibilityNoChanges: "Change at least one invincibility option.",
      invincibilityApply: "Apply Invincibility",
      invincibilityApplying: "Applying invincibility changes...",
      invincibilityApplied: count => `${count} invincibility changes were applied.`,
      backupOption: "Back up the save before this action",
      backupHint: "Optional and off by default. When selected, one timestamped SHA-256-verified backup is created for the next action.",
      close: "Close",
      back: "Back to Control Panel",
      apply: "Apply",
      bridgeChecking: "Checking the direct game helper...",
      bridgeConnected: "Direct game helper is ready — Cheat Engine is not needed",
      bridgeOffline: "The direct game helper is not ready.",
      running: "Applying selected map and Site of Grace groups...",
      addingRunes: "Adding runes...",
      succeeded: "Selected map and Site of Grace groups were applied.",
      runesAdded: (amount, balance) => `${amount} runes added. New balance: ${balance}.`,
      failed: "The command could not be applied.",
      timeout: "The direct helper did not return a result in time.",
      gameNotRunning: "Elden Ring is not running.",
      antiCheatRunning: "Easy Anti-Cheat is running. Start the game offline without EAC.",
      gameNotReady: "The game is open, but the required player data is not ready yet. Load your character and try again.",
      versionMismatch: "The current game version does not match the required pattern in the CT source.",
      runeAmountInvalid: "Enter a whole-number rune amount between 1 and 999,999,999.",
      runeLimitExceeded: remaining => `This would exceed the rune limit. You can add at most ${remaining} more runes.`,
      backupFailed: "A verified save backup could not be created, so nothing was written to game memory.",
      requestFailed: "The automation command could not be sent.",
      chooseOne: "Choose at least one automation.",
      sourceGroup: "CT source group",
      sourceRecord: "CT source record",
      backupCreated: name => `Save backup: ${name}`,
      selectedCount: count => `${count} selected`
    },
    tr: {
      label: "Oyun yardımcısı",
      open: "Otomasyonları Aç",
      hint: "İzinli harita, Lütuf Noktası, rune, eşya, boss, karakter ve ölümsüzlük komutlarını çalışan oyuna doğrudan uygula; Cheat Engine gerekmez.",
      title: "Elden Ring Otomasyonları",
      intro: "Harita veya Lütuf Noktası gruplarını uygula, rune ekle ya da Hexinton kataloğunda arayıp çalışan oyuna eşya ekle.",
      requirement: "Cheat Engine gerekmez. Elden Ring, Easy Anti-Cheat kapalı olarak çevrimdışı çalışıyor olmalı. Yardımcı Hexinton tablosundan yalnızca izinli harita, Lütuf Noktası, Add Runes, ItemGib, boss durumu, karakter statı ve ölümsüzlük sözleşmelerini okur; başka CT scriptleri çalıştırılmaz.",
      maps: "Haritalar",
      graces: "Lütuf Noktaları",
      runes: "Rune",
      runeAmount: "Eklenecek miktar",
      runeHint: "Rune'u oyunun kendi AddSoul fonksiyonuyla ekler. Elde tutulan toplam miktar 999.999.999 sınırını aşamaz.",
      addRunes: "Rune Ekle",
      items: "Eşya ekle",
      itemSearch: "Eşya arama",
      itemSearchPlaceholder: "Eşya adı veya CT kimliğiyle ara...",
      itemSearchHint: "Hexinton ItemGib listelerindeki silah, zırh, tılsım, büyü/eşya ve Ash of War kayıtlarında arar.",
      itemQuantity: "Eklenecek adet",
      itemQuantityInvalid: "1 ile 999 arasında tam sayı eşya adedi gir.",
      itemRequired: "Arama sonuçlarından bir eşya seç.",
      itemSearchEmpty: "Eşleşen eşya bulunamadı.",
      itemSearchPrompt: "Aramak için eşya adı veya CT kimliği yaz.",
      itemSearching: "Eşyalar aranıyor...",
      addItem: "Eşya Ekle",
      addingItem: "Eşya ekleniyor...",
      itemAdded: (name, quantity) => `${quantity} × ${name} eklendi.`,
      bosses: "Boss yönetimi",
      bossHint: "Çalışan oyundaki mevcut Yaşıyor/Ölü durumunu oku, birden fazla boss seç ve değişiklikleri birlikte uygula.",
      openBosses: "Boss Listesini Aç",
      bossTitle: "Boss Durumları",
      bossIntro: "Bu pencere açıldığında mevcut durumlar yakalanır. İstediğin kadar bossu işaretleyip yeni durumunu seçebilirsin.",
      bossSearch: "Boss ara",
      bossSearchPlaceholder: "Boss, konum veya bölge...",
      bossFilterAll: "Tümü",
      bossFilterMain: "Ana oyun",
      bossFilterDlc: "DLC",
      bossCurrent: "Mevcut",
      bossAlive: "Yaşıyor",
      bossDead: "Ölü",
      bossUnknown: "Bilinmiyor",
      bossTarget: "Yeni durum",
      bossRefresh: "Durumu Yenile",
      bossRefreshing: "Mevcut boss durumları okunuyor...",
      bossLiveState: "Mevcut durumlar canlı oyun belleğinden okundu.",
      bossSaveState: "Canlı bellek okunamadı; mevcut durumlar son okunabilir save görüntüsünden alındı.",
      bossStateUnavailable: "Mevcut boss durumları okunamadı. Karakteri yükleyip yenile.",
      bossNoResults: "Bu filtreyle eşleşen boss bulunamadı.",
      bossSelected: count => `${count} boss değişikliği seçildi`,
      bossChooseOne: "En az bir boss değişikliği seç.",
      bossApply: "Boss Değişikliklerini Uygula",
      bossApplying: "Seçili boss durumları uygulanıyor...",
      bossApplied: count => `${count} boss durum değişikliği uygulandı.`,
      bossSetSelectedAlive: "Seçilileri yaşat",
      bossSetSelectedDead: "Seçilileri öldür",
      bossTargetConflict: "Seçili bazı bosslar ortak durum bayrakları kullanıyor ve tek işlemde zıt durumlara getirilemiyor. Bu bossları ayrı ayrı uygula.",
      characterStats: "Karakter statları",
      characterStatsHint: "Mevcut rune levelini ve sekiz temel karakter statını oku ve değiştir.",
      openCharacterStats: "Karakter Statlarını Aç",
      characterStatsTitle: "Karakter Statları",
      characterStatsIntro: "Mevcut değerler yüklü karakterden okunur. Level, statlardaki toplam değişime göre otomatik hesaplanır.",
      characterStatsWarning: "Önce statlar, en son hesaplanan Level yazılır. Save yedeği alman önerilir.",
      characterStatsAuto: "Otomatik",
      characterStatsRefresh: "Değerleri Yenile",
      characterStatsRefreshing: "Mevcut karakter statları okunuyor...",
      characterStatsLive: "Mevcut değerler canlı oyun belleğinden okundu.",
      characterStatsUnavailable: "Karakter statları okunamadı. Karakteri yükleyip yenile.",
      characterStatsCurrent: "Mevcut",
      characterStatsChanges: count => `${count} stat değişikliği`,
      characterStatsInvalid: "Belirtilen aralıklarda tam sayı değerler gir.",
      characterStatsChooseOne: "En az bir değeri değiştir.",
      characterStatsReset: "Değişiklikleri Sıfırla",
      characterStatsApply: "Stat Değişikliklerini Uygula",
      characterStatsApplying: "Karakter stat değişiklikleri uygulanıyor...",
      characterStatsApplied: count => `${count} karakter stat değişikliği uygulandı.`,
      invincibility: "Ölümsüzlük",
      invincibilityHint: "Mevcut oyun oturumundaki karakter ve genel düşman ölüm engelleme bayraklarını oku ve değiştir.",
      playerImmortal: "Karakter ölümsüz",
      playerImmortalHint: "Karakter için Hexinton NoDead özelliğini açar. Hasar alınır fakat karakter ölmez.",
      bossesImmortal: "Bosslar ölümsüz",
      bossesImmortalHint: "Hexinton All No Dead özelliğini kullanır. Yalnızca aktif bossu değil; bütün boss, düşman ve NPC'leri etkiler.",
      invincibilitySessionOnly: "Bu özellikler yalnızca çalışan oyun oturumunu etkiler ve oyun kapandığında sıfırlanır.",
      invincibilityCurrent: "Mevcut",
      invincibilityOn: "Açık",
      invincibilityOff: "Kapalı",
      invincibilityRefresh: "Durumu Yenile",
      invincibilityLoading: "Ölümsüzlük durumları okunuyor...",
      invincibilityLive: "Mevcut durumlar canlı oyun belleğinden okundu.",
      invincibilityUnavailable: "Ölümsüzlük durumları okunamadı. Oyunu çevrimdışı başlatıp yenile.",
      invincibilityNoChanges: "En az bir ölümsüzlük seçeneğini değiştir.",
      invincibilityApply: "Ölümsüzlüğü Uygula",
      invincibilityApplying: "Ölümsüzlük değişiklikleri uygulanıyor...",
      invincibilityApplied: count => `${count} ölümsüzlük değişikliği uygulandı.`,
      backupOption: "Bu işlemden önce save yedeği al",
      backupHint: "İsteğe bağlıdır ve varsayılan olarak kapalıdır. Seçilirse sıradaki işlem için zaman damgalı, SHA-256 doğrulamalı tek yedek oluşturulur.",
      close: "Kapat",
      back: "Kontrol Paneline Dön",
      apply: "Uygula",
      bridgeChecking: "Doğrudan oyun yardımcısı kontrol ediliyor...",
      bridgeConnected: "Doğrudan oyun yardımcısı hazır — Cheat Engine gerekmiyor",
      bridgeOffline: "Doğrudan oyun yardımcısı hazır değil.",
      running: "Seçili harita ve Lütuf Noktası grupları uygulanıyor...",
      addingRunes: "Rune ekleniyor...",
      succeeded: "Seçili harita ve Lütuf Noktası grupları uygulandı.",
      runesAdded: (amount, balance) => `${amount} rune eklendi. Yeni bakiye: ${balance}.`,
      failed: "Komut uygulanamadı.",
      timeout: "Doğrudan yardımcı zamanında sonuç döndürmedi.",
      gameNotRunning: "Elden Ring çalışmıyor.",
      antiCheatRunning: "Easy Anti-Cheat çalışıyor. Oyunu EAC kapalı ve çevrimdışı başlat.",
      gameNotReady: "Oyun açık fakat gerekli oyuncu verisi henüz hazır değil. Karakteri yükleyip yeniden dene.",
      versionMismatch: "Mevcut oyun sürümü CT kaynağındaki gerekli desenle eşleşmiyor.",
      runeAmountInvalid: "1 ile 999.999.999 arasında tam sayı rune miktarı gir.",
      runeLimitExceeded: remaining => `Bu işlem rune sınırını aşar. En fazla ${remaining} rune daha ekleyebilirsin.`,
      backupFailed: "Doğrulanmış save yedeği oluşturulamadığı için oyun belleğine hiçbir şey yazılmadı.",
      requestFailed: "Otomasyon komutu gönderilemedi.",
      chooseOne: "En az bir otomasyon seç.",
      sourceGroup: "CT kaynak grubu",
      sourceRecord: "CT kaynak kaydı",
      backupCreated: name => `Save yedeği: ${name}`,
      selectedCount: count => `${count} seçenek seçildi`
    }
  };

  const selectedIds = new Set(
    AUTOMATIONS.filter(option => option.selected).map(option => option.id)
  );
  const root = document.getElementById("cheatAutomationRoot");
  let bridgeConnected = false;
  let mapsReady = false;
  let runesReady = false;
  let itemsReady = false;
  let bossesReady = false;
  let characterStatsReady = false;
  let invincibilityReady = false;
  let backupRequested = false;
  let runeAmount = "1000000";
  let itemQuery = "";
  let itemQuantity = "1";
  let itemResults = [];
  let selectedItem = null;
  let itemSearchTimer = null;
  let itemSearchSequence = 0;
  let bridgeCheckTimer = null;
  let automationRunning = false;
  let bossModalOpen = false;
  let bossLoading = false;
  let bossApplying = false;
  let bossList = [];
  let bossStateSource = null;
  let bossStateReadable = false;
  let bossStateWarning = null;
  let bossSearch = "";
  let bossFilter = "all";
  let bossStatusMessage = "";
  let bossStatusType = "";
  const bossTargets = new Map();
  let characterModalOpen = false;
  let characterLoading = false;
  let characterApplying = false;
  let characterReadable = false;
  let characterWarning = null;
  let characterFields = [];
  let characterStatusMessage = "";
  let characterStatusType = "";
  const characterDraft = new Map();
  let invincibilityLoaded = false;
  let invincibilityLoading = false;
  let invincibilityApplying = false;
  let invincibilityReadable = false;
  let invincibilityWarning = null;
  let invincibilityFields = [];
  let invincibilityStatusMessage = "";
  let invincibilityStatusType = "";
  const invincibilityDraft = new Map();

  if (!root) return;

  const panel = document.createElement("section");
  panel.className = "cheat-automation-page";
  panel.setAttribute("aria-labelledby", "cheatAutomationTitle");
  root.appendChild(panel);

  function language() {
    const select = document.getElementById("languageSelect");
    return select && select.value === "tr" ? "tr" : "en";
  }

  function t(key) {
    return COPY[language()][key];
  }

  function localized(value) {
    return value[language()] || value.en;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderStaticCopy() {
    const label = document.getElementById("cheatAutomationLabel");
    const hint = document.getElementById("cheatAutomationHint");
    const openButton = document.getElementById("openCheatAutomationButton");
    if (label) label.textContent = t("label");
    if (hint) hint.textContent = t("hint");
    if (openButton) openButton.textContent = t("open");
  }

  function renderOption(option) {
    return `
      <label class="cheat-automation-option">
        <input type="checkbox" data-role="automation" value="${escapeHtml(option.id)}" ${selectedIds.has(option.id) ? "checked" : ""}>
        <span class="cheat-automation-option-copy">
          <strong>${escapeHtml(localized(option.title))}</strong>
          <span>${escapeHtml(localized(option.description))}</span>
          <code>${escapeHtml(t("sourceGroup"))} #${option.sourceGroupId}</code>
        </span>
      </label>
    `;
  }

  function renderGroup(group) {
    const options = AUTOMATIONS.filter(option => option.group === group);
    return `
      <fieldset class="cheat-automation-group">
        <legend>${escapeHtml(t(group))}</legend>
        ${options.map(renderOption).join("")}
      </fieldset>
    `;
  }

  function itemCategoryLabel(category) {
    return ITEM_CATEGORY_COPY[language()][category] || category;
  }

  function itemResultMarkup() {
    if (selectedItem && itemQuery === selectedItem.name && !itemResults.length) return "";
    if (!itemQuery.trim()) {
      return `<div class="cheat-automation-item-message">${escapeHtml(t("itemSearchPrompt"))}</div>`;
    }
    if (!itemResults.length) {
      return `<div class="cheat-automation-item-message">${escapeHtml(t("itemSearchEmpty"))}</div>`;
    }
    return itemResults.map((item, index) => `
      <button class="cheat-automation-item-result" type="button" role="option" data-action="select-item" data-result-index="${index}">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(itemCategoryLabel(item.category))}</small>
        </span>
        <code>#${item.baseId}</code>
      </button>
    `).join("");
  }

  function selectedItemMarkup() {
    if (!selectedItem) return "";
    return `
      <div class="cheat-automation-selected-item">
        <span>
          <strong>${escapeHtml(selectedItem.name)}</strong>
          <small>${escapeHtml(itemCategoryLabel(selectedItem.category))}</small>
        </span>
        <code>#${selectedItem.baseId}</code>
      </div>
    `;
  }

  function filteredBosses() {
    const query = bossSearch.trim().toLocaleLowerCase(language() === "tr" ? "tr-TR" : "en-US");
    return bossList.filter(boss => {
      if (bossFilter === "main" && boss.dlc) return false;
      if (bossFilter === "dlc" && !boss.dlc) return false;
      if (!query) return true;
      return `${boss.name} ${boss.place} ${boss.regionName}`
        .toLocaleLowerCase(language() === "tr" ? "tr-TR" : "en-US")
        .includes(query);
    });
  }

  function bossCurrentLabel(boss) {
    if (boss.dead === true) return t("bossDead");
    if (boss.dead === false) return t("bossAlive");
    return t("bossUnknown");
  }

  function bossRowsMarkup() {
    if (bossLoading) {
      return `<div class="cheat-automation-boss-empty is-loading">${escapeHtml(t("bossRefreshing"))}</div>`;
    }
    const bosses = filteredBosses();
    if (!bosses.length) {
      return `<div class="cheat-automation-boss-empty">${escapeHtml(t("bossNoResults"))}</div>`;
    }
    return bosses.map(boss => {
      const target = bossTargets.get(boss.id) || (boss.dead === true ? "alive" : "dead");
      const selected = bossTargets.has(boss.id);
      const stateClass = boss.dead === true ? "is-dead" : boss.dead === false ? "is-alive" : "is-unknown";
      return `
        <div class="cheat-automation-boss-row ${selected ? "is-selected" : ""}">
          <label class="cheat-automation-boss-select">
            <input type="checkbox" data-role="boss-select" value="${escapeHtml(boss.id)}" ${selected ? "checked" : ""} ${boss.writable ? "" : "disabled"}>
            <span>
              <strong>${escapeHtml(boss.name)}</strong>
              <small>${escapeHtml([boss.place, boss.regionName, boss.dlc ? "DLC" : ""].filter(Boolean).join(" · "))}</small>
            </span>
          </label>
          <span class="cheat-automation-boss-current ${stateClass}">
            <small>${escapeHtml(t("bossCurrent"))}</small>
            <strong>${escapeHtml(bossCurrentLabel(boss))}</strong>
          </span>
          <label class="cheat-automation-boss-target">
            <span>${escapeHtml(t("bossTarget"))}</span>
            <select data-role="boss-target" data-boss-id="${escapeHtml(boss.id)}" ${selected ? "" : "disabled"}>
              <option value="alive" ${target === "alive" ? "selected" : ""}>${escapeHtml(t("bossAlive"))}</option>
              <option value="dead" ${target === "dead" ? "selected" : ""}>${escapeHtml(t("bossDead"))}</option>
            </select>
          </label>
        </div>
      `;
    }).join("");
  }

  function bossStateMessage() {
    if (bossLoading) return t("bossRefreshing");
    if (bossStateReadable && bossStateSource === "live-memory") return t("bossLiveState");
    if (bossStateReadable && bossStateSource === "save-fallback") return t("bossSaveState");
    return t("bossStateUnavailable");
  }

  function renderBossModal() {
    const dialog = panel.querySelector("#cheatAutomationBossDialog");
    if (!dialog) return;
    dialog.innerHTML = `
      <div class="cheat-automation-boss-shell">
        <header class="cheat-automation-boss-header">
          <div>
            <div class="cheat-automation-kicker">HEXINTON V5.0</div>
            <h3 id="cheatAutomationBossTitle">${escapeHtml(t("bossTitle"))}</h3>
            <p>${escapeHtml(t("bossIntro"))}</p>
          </div>
          <button class="cheat-automation-icon-button" type="button" data-action="close-bosses" aria-label="${escapeHtml(t("close"))}">×</button>
        </header>
        <div class="cheat-automation-boss-body">
          <div class="cheat-automation-boss-toolbar">
            <label>
              <span>${escapeHtml(t("bossSearch"))}</span>
              <input id="cheatAutomationBossSearch" type="search" autocomplete="off" maxlength="80" value="${escapeHtml(bossSearch)}" placeholder="${escapeHtml(t("bossSearchPlaceholder"))}">
            </label>
            <label>
              <span class="sr-only">${escapeHtml(t("bosses"))}</span>
              <select id="cheatAutomationBossFilter">
                <option value="all" ${bossFilter === "all" ? "selected" : ""}>${escapeHtml(t("bossFilterAll"))}</option>
                <option value="main" ${bossFilter === "main" ? "selected" : ""}>${escapeHtml(t("bossFilterMain"))}</option>
                <option value="dlc" ${bossFilter === "dlc" ? "selected" : ""}>${escapeHtml(t("bossFilterDlc"))}</option>
              </select>
            </label>
            <button type="button" data-action="refresh-bosses" ${bossLoading || bossApplying ? "disabled" : ""}>${escapeHtml(t("bossRefresh"))}</button>
          </div>
          <div id="cheatAutomationBossSource" class="cheat-automation-boss-source ${bossStateSource === "live-memory" ? "is-live" : "is-fallback"}">
            ${escapeHtml(bossStateMessage())}${bossStateWarning ? ` <code>${escapeHtml(bossStateWarning)}</code>` : ""}
          </div>
          <div class="cheat-automation-boss-bulk">
            <button type="button" data-action="boss-set-alive" ${bossTargets.size ? "" : "disabled"}>${escapeHtml(t("bossSetSelectedAlive"))}</button>
            <button type="button" data-action="boss-set-dead" ${bossTargets.size ? "" : "disabled"}>${escapeHtml(t("bossSetSelectedDead"))}</button>
          </div>
          <div id="cheatAutomationBossList" class="cheat-automation-boss-list">${bossRowsMarkup()}</div>
        </div>
        <footer class="cheat-automation-boss-footer">
          <div class="cheat-automation-boss-footer-copy">
            <label class="cheat-automation-boss-backup">
              <input type="checkbox" data-role="boss-backup" ${backupRequested ? "checked" : ""}>
              <span>${escapeHtml(t("backupOption"))}</span>
            </label>
            <strong id="cheatAutomationBossSelection">${escapeHtml(t("bossSelected")(bossTargets.size))}</strong>
            <span id="cheatAutomationBossStatus" class="field-hint ${bossStatusType ? `is-${bossStatusType}` : ""}" role="status" aria-live="polite">${escapeHtml(bossStatusMessage)}</span>
          </div>
          <div class="cheat-automation-boss-actions">
            <button type="button" data-action="close-bosses">${escapeHtml(t("close"))}</button>
            <button class="primary" type="button" data-action="apply-bosses" ${!bossTargets.size || !bridgeConnected || !bossesReady || bossLoading || bossApplying ? "disabled" : ""}>${escapeHtml(t("bossApply"))}</button>
          </div>
        </footer>
      </div>
    `;
  }

  function renderBossRows() {
    const list = panel.querySelector("#cheatAutomationBossList");
    if (list) list.innerHTML = bossRowsMarkup();
    const selection = panel.querySelector("#cheatAutomationBossSelection");
    if (selection) selection.textContent = t("bossSelected")(bossTargets.size);
    updateBossModalControls();
  }

  function updateBossModalControls() {
    const apply = panel.querySelector('[data-action="apply-bosses"]');
    if (apply) apply.disabled = !bossTargets.size || !bridgeConnected || !bossesReady || bossLoading || bossApplying;
    const refresh = panel.querySelector('[data-action="refresh-bosses"]');
    if (refresh) refresh.disabled = bossLoading || bossApplying;
    panel.querySelectorAll('[data-action="boss-set-alive"], [data-action="boss-set-dead"]').forEach(button => {
      button.disabled = bossTargets.size === 0 || bossApplying;
    });
  }

  function setBossStatus(message, type) {
    bossStatusMessage = message;
    bossStatusType = type || "";
    const status = panel.querySelector("#cheatAutomationBossStatus");
    if (!status) return;
    status.textContent = bossStatusMessage;
    status.className = `field-hint ${bossStatusType ? `is-${bossStatusType}` : ""}`;
  }

  function characterStatLabel(key) {
    return CHARACTER_STAT_COPY[language()][key] || key;
  }

  function recalculateCharacterLevel() {
    const levelField = characterFields.find(field => field.key === "level");
    if (!levelField || !Number.isSafeInteger(levelField.value)) return;
    let delta = 0;
    let valid = true;
    for (const field of characterFields) {
      if (field.key === "level") continue;
      const value = Number(characterDraft.get(field.key));
      if (!Number.isSafeInteger(value) || value < field.min || value > field.max || !Number.isSafeInteger(field.value)) {
        valid = false;
        break;
      }
      delta += value - field.value;
    }
    const calculated = valid ? levelField.value + delta : "";
    characterDraft.set("level", String(calculated));
    const input = panel.querySelector('input[data-role="character-stat"][data-stat-key="level"]');
    if (input) input.value = String(calculated);
  }

  function characterChanges() {
    const values = {};
    let invalid = false;
    for (const field of characterFields) {
      const rawValue = characterDraft.get(field.key);
      const value = Number(rawValue);
      if (!Number.isSafeInteger(value) || value < field.min || value > field.max) {
        invalid = true;
        continue;
      }
      if (value !== field.value) values[field.key] = value;
    }
    return { values, count: Object.keys(values).length, invalid };
  }

  function characterFieldsMarkup() {
    if (characterLoading) {
      return `<div class="cheat-automation-character-empty">${escapeHtml(t("characterStatsRefreshing"))}</div>`;
    }
    if (!characterFields.length) {
      return `<div class="cheat-automation-character-empty">${escapeHtml(t("characterStatsUnavailable"))}</div>`;
    }
    return characterFields.map(field => {
      const draft = characterDraft.has(field.key) ? characterDraft.get(field.key) : "";
      const value = Number(draft);
      const invalid = draft === "" || !Number.isSafeInteger(value) || value < field.min || value > field.max;
      return `
        <label class="cheat-automation-character-field ${field.key === "level" ? "is-level" : ""} ${invalid ? "is-invalid" : ""}">
          <span>
            <strong>${escapeHtml(characterStatLabel(field.key))}</strong>
            <small>${escapeHtml(t("characterStatsCurrent"))}: ${field.value ?? "—"} · ${field.min}–${field.max}${field.key === "level" ? ` · ${escapeHtml(t("characterStatsAuto"))}` : ""}</small>
          </span>
          <input type="number" data-role="character-stat" data-stat-key="${escapeHtml(field.key)}" min="${field.min}" max="${field.max}" step="1" inputmode="numeric" value="${escapeHtml(draft)}" ${field.key === "level" ? "readonly" : ""} ${!characterReadable || characterLoading || characterApplying ? "disabled" : ""}>
          <code>#${field.sourceRecordId}</code>
        </label>
      `;
    }).join("");
  }

  function characterStateMessage() {
    if (characterLoading) return t("characterStatsRefreshing");
    if (characterReadable) return t("characterStatsLive");
    return t("characterStatsUnavailable");
  }

  function renderCharacterModal() {
    const dialog = panel.querySelector("#cheatAutomationCharacterDialog");
    if (!dialog) return;
    const changes = characterChanges();
    dialog.innerHTML = `
      <div class="cheat-automation-character-shell">
        <header class="cheat-automation-boss-header">
          <div>
            <div class="cheat-automation-kicker">HEXINTON V5.0</div>
            <h3 id="cheatAutomationCharacterTitle">${escapeHtml(t("characterStatsTitle"))}</h3>
            <p>${escapeHtml(t("characterStatsIntro"))}</p>
          </div>
          <button class="cheat-automation-icon-button" type="button" data-action="close-character-stats" aria-label="${escapeHtml(t("close"))}">×</button>
        </header>
        <div class="cheat-automation-character-body">
          <div class="cheat-automation-character-toolbar">
            <div class="cheat-automation-boss-source ${characterReadable ? "is-live" : "is-fallback"}">
              ${escapeHtml(characterStateMessage())}${characterWarning ? ` <code>${escapeHtml(characterWarning)}</code>` : ""}
            </div>
            <button type="button" data-action="refresh-character-stats" ${characterLoading || characterApplying ? "disabled" : ""}>${escapeHtml(t("characterStatsRefresh"))}</button>
          </div>
          <div class="cheat-automation-warning cheat-automation-character-warning">${escapeHtml(t("characterStatsWarning"))}</div>
          <div id="cheatAutomationCharacterFields" class="cheat-automation-character-fields">${characterFieldsMarkup()}</div>
        </div>
        <footer class="cheat-automation-boss-footer">
          <div class="cheat-automation-boss-footer-copy">
            <label class="cheat-automation-boss-backup">
              <input type="checkbox" data-role="character-backup" ${backupRequested ? "checked" : ""}>
              <span>${escapeHtml(t("backupOption"))}</span>
            </label>
            <strong id="cheatAutomationCharacterSelection">${escapeHtml(t("characterStatsChanges")(changes.count))}</strong>
            <span id="cheatAutomationCharacterStatus" class="field-hint ${characterStatusType ? `is-${characterStatusType}` : ""}" role="status" aria-live="polite">${escapeHtml(characterStatusMessage)}</span>
          </div>
          <div class="cheat-automation-boss-actions">
            <button type="button" data-action="reset-character-stats" ${changes.count ? "" : "disabled"}>${escapeHtml(t("characterStatsReset"))}</button>
            <button type="button" data-action="close-character-stats">${escapeHtml(t("close"))}</button>
            <button class="primary" type="button" data-action="apply-character-stats" ${!characterReadable || !changes.count || changes.invalid || !bridgeConnected || !characterStatsReady || characterLoading || characterApplying ? "disabled" : ""}>${escapeHtml(t("characterStatsApply"))}</button>
          </div>
        </footer>
      </div>
    `;
  }

  function updateCharacterModalControls() {
    const changes = characterChanges();
    const selection = panel.querySelector("#cheatAutomationCharacterSelection");
    if (selection) selection.textContent = t("characterStatsChanges")(changes.count);
    const apply = panel.querySelector('[data-action="apply-character-stats"]');
    if (apply) {
      apply.disabled = !characterReadable || !changes.count || changes.invalid || !bridgeConnected || !characterStatsReady || characterLoading || characterApplying;
    }
    const reset = panel.querySelector('[data-action="reset-character-stats"]');
    if (reset) reset.disabled = changes.count === 0 || characterApplying;
    const refresh = panel.querySelector('[data-action="refresh-character-stats"]');
    if (refresh) refresh.disabled = characterLoading || characterApplying;
    panel.querySelectorAll('input[data-role="character-stat"]').forEach(input => {
      const field = characterFields.find(item => item.key === input.dataset.statKey);
      const value = Number(input.value);
      const invalid = !field || input.value === "" || !Number.isSafeInteger(value) || value < field.min || value > field.max;
      input.closest(".cheat-automation-character-field")?.classList.toggle("is-invalid", invalid);
    });
  }

  function setCharacterStatus(message, type) {
    characterStatusMessage = message;
    characterStatusType = type || "";
    const status = panel.querySelector("#cheatAutomationCharacterStatus");
    if (!status) return;
    status.textContent = characterStatusMessage;
    status.className = `field-hint ${characterStatusType ? `is-${characterStatusType}` : ""}`;
  }

  function invincibilityDefinitions() {
    const fallback = [
      { key: "player", sourceRecordId: 1337309231, enabled: null },
      { key: "bosses", sourceRecordId: 1337304805, enabled: null }
    ];
    return fallback.map(definition => invincibilityFields.find(field => field.key === definition.key) || definition);
  }

  function invincibilityChanges() {
    const values = {};
    if (!invincibilityReadable) return values;
    for (const field of invincibilityDefinitions()) {
      if (!invincibilityDraft.has(field.key)) continue;
      const target = Boolean(invincibilityDraft.get(field.key));
      if (target !== Boolean(field.enabled)) values[field.key] = target;
    }
    return values;
  }

  function invincibilityStateMessage() {
    if (invincibilityLoading) return t("invincibilityLoading");
    if (invincibilityReadable) return t("invincibilityLive");
    return t("invincibilityUnavailable");
  }

  function invincibilityOptionMarkup(field) {
    const player = field.key === "player";
    const checked = invincibilityDraft.has(field.key)
      ? Boolean(invincibilityDraft.get(field.key))
      : Boolean(field.enabled);
    const current = invincibilityReadable
      ? (field.enabled ? t("invincibilityOn") : t("invincibilityOff"))
      : "—";
    return `
      <label class="cheat-automation-option cheat-automation-invincibility-option">
        <input type="checkbox" data-role="invincibility" data-invincibility-key="${escapeHtml(field.key)}" ${checked ? "checked" : ""} ${!invincibilityReadable || invincibilityLoading || invincibilityApplying ? "disabled" : ""}>
        <span class="cheat-automation-option-copy">
          <strong>${escapeHtml(t(player ? "playerImmortal" : "bossesImmortal"))}</strong>
          <span>${escapeHtml(t(player ? "playerImmortalHint" : "bossesImmortalHint"))}</span>
          <span class="cheat-automation-invincibility-current">${escapeHtml(t("invincibilityCurrent"))}: <b>${escapeHtml(current)}</b></span>
          <code>${escapeHtml(t("sourceRecord"))} #${field.sourceRecordId}</code>
        </span>
      </label>
    `;
  }

  function invincibilityMarkup() {
    const changeCount = Object.keys(invincibilityChanges()).length;
    return `
      <div class="cheat-automation-invincibility-toolbar">
        <div class="cheat-automation-boss-source ${invincibilityReadable ? "is-live" : "is-fallback"}">
          ${escapeHtml(invincibilityStateMessage())}${invincibilityWarning ? ` <code>${escapeHtml(invincibilityWarning)}</code>` : ""}
        </div>
        <button type="button" data-action="refresh-invincibility" ${invincibilityLoading || invincibilityApplying ? "disabled" : ""}>${escapeHtml(t("invincibilityRefresh"))}</button>
      </div>
      <div class="cheat-automation-invincibility-options">
        ${invincibilityDefinitions().map(invincibilityOptionMarkup).join("")}
      </div>
      <div class="cheat-automation-invincibility-note">${escapeHtml(t("invincibilitySessionOnly"))}</div>
      <div class="cheat-automation-invincibility-actions">
        <span id="cheatAutomationInvincibilityStatus" class="field-hint ${invincibilityStatusType ? `is-${invincibilityStatusType}` : ""}" role="status" aria-live="polite">${escapeHtml(invincibilityStatusMessage)}</span>
        <button class="primary" type="button" data-action="apply-invincibility" ${!invincibilityReadable || !changeCount || !bridgeConnected || !invincibilityReady || invincibilityLoading || invincibilityApplying ? "disabled" : ""}>${escapeHtml(t("invincibilityApply"))}</button>
      </div>
    `;
  }

  function renderInvincibility() {
    const container = panel.querySelector("#cheatAutomationInvincibility");
    if (container) container.innerHTML = invincibilityMarkup();
  }

  function updateInvincibilityControls() {
    const changes = invincibilityChanges();
    const apply = panel.querySelector('[data-action="apply-invincibility"]');
    if (apply) {
      apply.disabled = !invincibilityReadable || !Object.keys(changes).length || !bridgeConnected || !invincibilityReady || invincibilityLoading || invincibilityApplying;
    }
    const refresh = panel.querySelector('[data-action="refresh-invincibility"]');
    if (refresh) refresh.disabled = invincibilityLoading || invincibilityApplying;
  }

  function setInvincibilityStatus(message, type) {
    invincibilityStatusMessage = message;
    invincibilityStatusType = type || "";
    const status = panel.querySelector("#cheatAutomationInvincibilityStatus");
    if (!status) return;
    status.textContent = invincibilityStatusMessage;
    status.className = `field-hint ${invincibilityStatusType ? `is-${invincibilityStatusType}` : ""}`;
  }

  function renderPage() {
    panel.innerHTML = `
      <div class="cheat-automation-content">
        <div class="cheat-automation-header">
          <div>
            <div class="cheat-automation-kicker">HEXINTON V5.0</div>
            <h2 id="cheatAutomationTitle">${escapeHtml(t("title"))}</h2>
          </div>
          <button class="cheat-automation-icon-button" type="button" data-action="back" aria-label="${escapeHtml(t("back"))}">←</button>
        </div>
        <p class="cheat-automation-intro">${escapeHtml(t("intro"))}</p>
        <div class="cheat-automation-warning">${escapeHtml(t("requirement"))}</div>
        <div id="cheatAutomationBridge" class="cheat-automation-bridge is-checking">${escapeHtml(t("bridgeChecking"))}</div>
        <div class="cheat-automation-groups">
          ${renderGroup("maps")}
          ${renderGroup("graces")}
          <fieldset class="cheat-automation-group">
            <legend>${escapeHtml(t("runes"))}</legend>
            <div class="cheat-automation-rune-row">
              <label for="cheatAutomationRuneAmount">${escapeHtml(t("runeAmount"))}</label>
              <div class="cheat-automation-rune-controls">
                <input id="cheatAutomationRuneAmount" type="number" min="1" max="999999999" step="1" inputmode="numeric" value="${escapeHtml(runeAmount)}">
                <button class="primary" type="button" data-action="add-runes">${escapeHtml(t("addRunes"))}</button>
              </div>
              <span>${escapeHtml(t("runeHint"))}</span>
              <code>${escapeHtml(t("sourceRecord"))} #1337192510</code>
            </div>
          </fieldset>
          <fieldset class="cheat-automation-group">
            <legend>${escapeHtml(t("items"))}</legend>
            <div class="cheat-automation-item-row">
              <label for="cheatAutomationItemSearch">${escapeHtml(t("itemSearch"))}</label>
              <input id="cheatAutomationItemSearch" type="search" autocomplete="off" maxlength="80" placeholder="${escapeHtml(t("itemSearchPlaceholder"))}" value="${escapeHtml(itemQuery)}" aria-controls="cheatAutomationItemResults">
              <span>${escapeHtml(t("itemSearchHint"))}</span>
              <div id="cheatAutomationItemResults" class="cheat-automation-item-results" role="listbox">
                ${itemResultMarkup()}
              </div>
              <div id="cheatAutomationSelectedItem">${selectedItemMarkup()}</div>
              <div class="cheat-automation-item-add-row">
                <label for="cheatAutomationItemQuantity">${escapeHtml(t("itemQuantity"))}</label>
                <div class="cheat-automation-item-controls">
                  <input id="cheatAutomationItemQuantity" type="number" min="1" max="999" step="1" inputmode="numeric" value="${escapeHtml(itemQuantity)}">
                  <button class="primary" type="button" data-action="add-item">${escapeHtml(t("addItem"))}</button>
                </div>
              </div>
              <code>${escapeHtml(t("sourceRecord"))} #22032400–22032404</code>
            </div>
          </fieldset>
          <fieldset class="cheat-automation-group">
            <legend>${escapeHtml(t("bosses"))}</legend>
            <div class="cheat-automation-boss-launcher">
              <div>
                <strong>${escapeHtml(t("bosses"))}</strong>
                <span>${escapeHtml(t("bossHint"))}</span>
                <code>${escapeHtml(t("sourceGroup"))} #1337304929 / #1337314897</code>
              </div>
              <button class="primary" type="button" data-action="open-bosses">${escapeHtml(t("openBosses"))}</button>
            </div>
          </fieldset>
          <fieldset class="cheat-automation-group">
            <legend>${escapeHtml(t("characterStats"))}</legend>
            <div class="cheat-automation-boss-launcher">
              <div>
                <strong>${escapeHtml(t("characterStats"))}</strong>
                <span>${escapeHtml(t("characterStatsHint"))}</span>
                <code>${escapeHtml(t("sourceGroup"))} #1337193298</code>
              </div>
              <button class="primary" type="button" data-action="open-character-stats">${escapeHtml(t("openCharacterStats"))}</button>
            </div>
          </fieldset>
          <fieldset class="cheat-automation-group">
            <legend>${escapeHtml(t("invincibility"))}</legend>
            <p class="cheat-automation-group-intro">${escapeHtml(t("invincibilityHint"))}</p>
            <div id="cheatAutomationInvincibility">${invincibilityMarkup()}</div>
          </fieldset>
          <fieldset class="cheat-automation-group cheat-automation-backup-group">
            <legend>Save</legend>
            <label class="cheat-automation-option">
              <input type="checkbox" data-role="backup" ${backupRequested ? "checked" : ""}>
              <span class="cheat-automation-option-copy">
                <strong>${escapeHtml(t("backupOption"))}</strong>
                <span>${escapeHtml(t("backupHint"))}</span>
              </span>
            </label>
          </fieldset>
        </div>
        <div class="cheat-automation-footer">
          <div>
            <div id="cheatAutomationSelection" class="cheat-automation-selection"></div>
            <div id="cheatAutomationStatus" class="field-hint" role="status" aria-live="polite"></div>
          </div>
          <div class="cheat-automation-actions">
            <button type="button" data-action="back">${escapeHtml(t("back"))}</button>
            <button class="primary" type="button" data-action="apply">${escapeHtml(t("apply"))}</button>
          </div>
        </div>
      </div>
      <dialog id="cheatAutomationBossDialog" class="cheat-automation-boss-dialog" aria-labelledby="cheatAutomationBossTitle"></dialog>
      <dialog id="cheatAutomationCharacterDialog" class="cheat-automation-character-dialog" aria-labelledby="cheatAutomationCharacterTitle"></dialog>
    `;
    updateSelectionState();
    if (bossModalOpen) {
      renderBossModal();
      const dialog = panel.querySelector("#cheatAutomationBossDialog");
      if (dialog && !dialog.open) dialog.showModal();
    }
    if (characterModalOpen) {
      renderCharacterModal();
      const dialog = panel.querySelector("#cheatAutomationCharacterDialog");
      if (dialog && !dialog.open) dialog.showModal();
    }
  }

  function renderItemResults(messageKey) {
    const results = panel.querySelector("#cheatAutomationItemResults");
    if (!results) return;
    results.innerHTML = messageKey
      ? `<div class="cheat-automation-item-message">${escapeHtml(t(messageKey))}</div>`
      : itemResultMarkup();
  }

  function renderSelectedItem() {
    const selected = panel.querySelector("#cheatAutomationSelectedItem");
    if (selected) selected.innerHTML = selectedItemMarkup();
    updateSelectionState();
  }

  function updateSelectionState() {
    const count = selectedIds.size;
    const selection = panel.querySelector("#cheatAutomationSelection");
    const applyButton = panel.querySelector('[data-action="apply"]');
    const addRunesButton = panel.querySelector('[data-action="add-runes"]');
    const addItemButton = panel.querySelector('[data-action="add-item"]');
    const openBossesButton = panel.querySelector('[data-action="open-bosses"]');
    const openCharacterStatsButton = panel.querySelector('[data-action="open-character-stats"]');
    if (selection) selection.textContent = t("selectedCount")(count);
    if (applyButton) applyButton.disabled = count === 0 || !bridgeConnected || !mapsReady || automationRunning;
    if (addRunesButton) {
      addRunesButton.disabled = !bridgeConnected || !runesReady || !validRuneAmount() || automationRunning;
    }
    if (addItemButton) {
      addItemButton.disabled = !bridgeConnected || !itemsReady || !selectedItem || !validItemQuantity() || automationRunning;
    }
    if (openBossesButton) openBossesButton.disabled = !bossesReady || automationRunning;
    if (openCharacterStatsButton) openCharacterStatsButton.disabled = !characterStatsReady || automationRunning;
    updateInvincibilityControls();
  }

  function validRuneAmount() {
    const amount = Number(runeAmount);
    return Number.isSafeInteger(amount) && amount >= 1 && amount <= 999999999;
  }

  function validItemQuantity() {
    const quantity = Number(itemQuantity);
    return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 999;
  }

  function selectedAutomations() {
    return AUTOMATIONS.filter(option => selectedIds.has(option.id));
  }

  function setStatus(message, type) {
    const status = panel.querySelector("#cheatAutomationStatus");
    if (!status) return;
    status.textContent = message;
    status.className = `field-hint ${type ? `is-${type}` : ""}`;
  }

  function renderBridgeStatus() {
    const node = panel.querySelector("#cheatAutomationBridge");
    if (!node) return;
    node.textContent = bridgeConnected ? t("bridgeConnected") : t("bridgeOffline");
    node.className = `cheat-automation-bridge ${bridgeConnected ? "is-connected" : "is-offline"}`;
    updateSelectionState();
  }

  async function refreshBridgeStatus() {
    try {
      const response = await fetch("/api/cheat-automations/bridge", { cache: "no-store" });
      const result = await response.json();
      bridgeConnected = Boolean(response.ok && result.connected);
      mapsReady = Boolean(bridgeConnected && result.features?.maps?.ready);
      runesReady = Boolean(bridgeConnected && result.features?.runes?.ready);
      itemsReady = Boolean(bridgeConnected && result.features?.items?.ready);
      bossesReady = Boolean(result.features?.bosses?.ready);
      characterStatsReady = Boolean(result.features?.characterStats?.ready);
      invincibilityReady = Boolean(result.features?.invincibility?.ready);
    } catch (_) {
      bridgeConnected = false;
      mapsReady = false;
      runesReady = false;
      itemsReady = false;
      bossesReady = false;
      characterStatsReady = false;
      invincibilityReady = false;
    }
    renderBridgeStatus();
    if (bossModalOpen) updateBossModalControls();
    if (characterModalOpen) updateCharacterModalControls();
    if (bridgeConnected && invincibilityReady && !invincibilityLoaded && !invincibilityLoading) {
      loadInvincibility();
    }
    return bridgeConnected;
  }

  function statusMessageFor(command) {
    let message;
    if (
      command.errorCode === "HELPER_TIMEOUT" ||
      command.errorCode === "RUNE_CALL_TIMEOUT" ||
      command.errorCode === "ITEM_CALL_TIMEOUT"
    ) message = t("timeout");
    else if (command.errorCode === "GAME_NOT_RUNNING") message = t("gameNotRunning");
    else if (command.errorCode === "ANTI_CHEAT_RUNNING") message = t("antiCheatRunning");
    if (
      command.errorCode === "EVENT_FLAG_MANAGER_NULL" ||
      command.errorCode === "EVENT_FLAG_BUFFER_NULL" ||
      command.errorCode === "WORLD_CHR_MANAGER_NULL" ||
      command.errorCode === "LOCAL_PLAYER_NULL" ||
      command.errorCode === "LOCAL_PLAYER_DATA_NULL" ||
      command.errorCode === "RUNE_CONTAINER_NULL" ||
      command.errorCode === "INVENTORY_MANAGER_NULL" ||
      command.errorCode === "GAME_DATA_MANAGER_NULL" ||
      command.errorCode === "CHARACTER_DATA_NULL"
    ) {
      message = t("gameNotReady");
    }
    if (command.errorCode === "PATTERN_NOT_FOUND" || command.errorCode === "PATTERN_NOT_UNIQUE") {
      message = t("versionMismatch");
    }
    if (command.errorCode === "RUNE_LIMIT_EXCEEDED") {
      message = t("runeLimitExceeded")(formatNumber(Number(command.detail || 0)));
    }
    if (command.errorCode === "BOSS_TARGET_CONFLICT") message = t("bossTargetConflict");
    if (command.errorCode?.startsWith("SAVE_")) message = t("backupFailed");
    if (!message) message = command.detail ? `${t("failed")} ${command.detail}` : t("failed");
    return command.backup ? `${message} ${backupMessage(command.backup)}` : message;
  }

  function backupMessage(backup) {
    const name = String(backup?.path || "").split("/").pop();
    return name ? t("backupCreated")(name) : "";
  }

  function consumeBackupOption() {
    backupRequested = false;
    const checkbox = panel.querySelector('input[data-role="backup"]');
    if (checkbox) checkbox.checked = false;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(language() === "tr" ? "tr-TR" : "en-US").format(value);
  }

  async function waitForCommand(commandId) {
    for (let attempt = 0; attempt < 75; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const response = await fetch(`/api/cheat-automations/status?id=${encodeURIComponent(commandId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.command) throw new Error(result.code || "COMMAND_STATUS_FAILED");
      if (result.command.state === "succeeded") return result.command;
      if (result.command.state === "failed") {
        throw Object.assign(new Error("COMMAND_FAILED"), { command: result.command });
      }
    }
    throw Object.assign(new Error("HELPER_TIMEOUT"), {
      command: { errorCode: "HELPER_TIMEOUT", detail: "" }
    });
  }

  async function applySelectedAutomations() {
    if (!selectedIds.size) {
      setStatus(t("chooseOne"), "error");
      return;
    }
    if (!bridgeConnected && !(await refreshBridgeStatus())) {
      setStatus(t("bridgeOffline"), "error");
      return;
    }

    automationRunning = true;
    updateSelectionState();
    setStatus(t("running"), "pending");
    try {
      const response = await fetch("/api/cheat-automations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: selectedAutomations().map(option => option.id),
          backup: backupRequested
        })
      });
      const result = await response.json();
      if (!response.ok || !result.command) {
        if (result.code === "CT_CATALOG_INVALID" || result.code === "HELPER_NOT_BUILT" || result.code === "CROSSOVER_NOT_FOUND") {
          bridgeConnected = false;
        }
        throw new Error(result.code || "COMMAND_SEND_FAILED");
      }
      consumeBackupOption();
      const command = await waitForCommand(result.command.id);
      setStatus(`${t("succeeded")} ${backupMessage(command.backup)}`.trim(), "done");
    } catch (error) {
      setStatus(error.command ? statusMessageFor(error.command) : t("requestFailed"), "error");
    } finally {
      automationRunning = false;
      renderBridgeStatus();
    }
  }

  async function addRunes() {
    if (!validRuneAmount()) {
      setStatus(t("runeAmountInvalid"), "error");
      return;
    }
    if (!bridgeConnected && !(await refreshBridgeStatus())) {
      setStatus(t("bridgeOffline"), "error");
      return;
    }

    const amount = Number(runeAmount);
    automationRunning = true;
    updateSelectionState();
    setStatus(t("addingRunes"), "pending");
    try {
      const response = await fetch("/api/cheat-automations/runes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, backup: backupRequested })
      });
      const result = await response.json();
      if (!response.ok || !result.command) {
        if (result.code === "INVALID_RUNE_AMOUNT") {
          setStatus(t("runeAmountInvalid"), "error");
          return;
        }
        throw new Error(result.code || "COMMAND_SEND_FAILED");
      }
      consumeBackupOption();
      const command = await waitForCommand(result.command.id);
      const [, , balance] = String(command.detail || "").split(":").map(Number);
      const message = t("runesAdded")(formatNumber(command.amount || amount), formatNumber(balance));
      setStatus(`${message} ${backupMessage(command.backup)}`.trim(), "done");
    } catch (error) {
      setStatus(error.command ? statusMessageFor(error.command) : t("requestFailed"), "error");
    } finally {
      automationRunning = false;
      renderBridgeStatus();
    }
  }

  function scheduleItemSearch() {
    clearTimeout(itemSearchTimer);
    itemSearchTimer = null;
    const query = itemQuery.trim();
    if (!query) {
      itemResults = [];
      renderItemResults();
      return;
    }
    renderItemResults("itemSearching");
    const sequence = ++itemSearchSequence;
    itemSearchTimer = setTimeout(() => lookupItems(query, sequence), 220);
  }

  async function lookupItems(query, sequence) {
    try {
      const response = await fetch(`/api/cheat-automations/items?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const result = await response.json();
      if (sequence !== itemSearchSequence || query !== itemQuery.trim()) return;
      if (!response.ok || !Array.isArray(result.results)) throw new Error(result.code || "ITEM_LOOKUP_FAILED");
      itemResults = result.results;
      renderItemResults();
    } catch (_) {
      if (sequence !== itemSearchSequence) return;
      itemResults = [];
      renderItemResults("itemSearchEmpty");
      setStatus(t("requestFailed"), "error");
    }
  }

  function selectItem(index) {
    const item = itemResults[index];
    if (!item) return;
    selectedItem = item;
    itemQuery = item.name;
    itemResults = [];
    const input = panel.querySelector("#cheatAutomationItemSearch");
    if (input) input.value = itemQuery;
    const results = panel.querySelector("#cheatAutomationItemResults");
    if (results) results.innerHTML = "";
    renderSelectedItem();
    setStatus("", "");
  }

  async function addItem() {
    if (!selectedItem) {
      setStatus(t("itemRequired"), "error");
      return;
    }
    if (!validItemQuantity()) {
      setStatus(t("itemQuantityInvalid"), "error");
      return;
    }
    if (!bridgeConnected && !(await refreshBridgeStatus())) {
      setStatus(t("bridgeOffline"), "error");
      return;
    }

    const item = selectedItem;
    const quantity = Number(itemQuantity);
    automationRunning = true;
    updateSelectionState();
    setStatus(t("addingItem"), "pending");
    try {
      const response = await fetch("/api/cheat-automations/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: item.key, quantity, backup: backupRequested })
      });
      const result = await response.json();
      if (!response.ok || !result.command) {
        if (result.code === "INVALID_ITEM_QUANTITY") {
          setStatus(t("itemQuantityInvalid"), "error");
          return;
        }
        if (result.code === "UNKNOWN_ITEM") {
          selectedItem = null;
          renderSelectedItem();
          setStatus(t("itemRequired"), "error");
          return;
        }
        throw new Error(result.code || "COMMAND_SEND_FAILED");
      }
      consumeBackupOption();
      const command = await waitForCommand(result.command.id);
      const addedItem = command.item || item;
      const message = t("itemAdded")(addedItem.name, formatNumber(command.quantity || quantity));
      setStatus(`${message} ${backupMessage(command.backup)}`.trim(), "done");
    } catch (error) {
      setStatus(error.command ? statusMessageFor(error.command) : t("requestFailed"), "error");
    } finally {
      automationRunning = false;
      renderBridgeStatus();
    }
  }

  async function loadBossStates() {
    bossLoading = true;
    bossStateWarning = null;
    renderBossModal();
    try {
      const response = await fetch("/api/cheat-automations/bosses", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.bosses)) throw new Error(result.code || "BOSS_LOOKUP_FAILED");
      bossList = result.bosses;
      bossStateSource = result.source || null;
      bossStateReadable = Boolean(result.readable);
      bossStateWarning = result.warning || null;
      const knownIds = new Set(bossList.map(boss => boss.id));
      for (const id of bossTargets.keys()) {
        if (!knownIds.has(id)) bossTargets.delete(id);
      }
    } catch (error) {
      bossStateReadable = false;
      bossStateSource = null;
      bossStateWarning = String(error.message || error);
    } finally {
      bossLoading = false;
      renderBossModal();
    }
  }

  function openBossModal() {
    bossModalOpen = true;
    bossStatusMessage = "";
    bossStatusType = "";
    renderBossModal();
    const dialog = panel.querySelector("#cheatAutomationBossDialog");
    if (dialog && !dialog.open) dialog.showModal();
    loadBossStates();
  }

  function closeBossModal() {
    if (bossApplying) return;
    bossModalOpen = false;
    const dialog = panel.querySelector("#cheatAutomationBossDialog");
    if (dialog?.open) dialog.close();
  }

  function setSelectedBossTarget(state) {
    for (const id of bossTargets.keys()) bossTargets.set(id, state);
    setBossStatus("", "");
    renderBossRows();
  }

  async function applyBossChanges() {
    if (!bossTargets.size) {
      setBossStatus(t("bossChooseOne"), "error");
      return;
    }
    if (!bridgeConnected && !(await refreshBridgeStatus())) {
      setBossStatus(t("bridgeOffline"), "error");
      return;
    }

    const changes = [...bossTargets].map(([id, state]) => ({ id, state }));
    bossApplying = true;
    automationRunning = true;
    setBossStatus(t("bossApplying"), "pending");
    renderBossModal();
    updateSelectionState();
    try {
      const response = await fetch("/api/cheat-automations/bosses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, backup: backupRequested })
      });
      const result = await response.json();
      if (!response.ok || !result.command) throw new Error(result.code || "COMMAND_SEND_FAILED");
      consumeBackupOption();
      const command = await waitForCommand(result.command.id);
      bossTargets.clear();
      await loadBossStates();
      setBossStatus(`${t("bossApplied")(changes.length)} ${backupMessage(command.backup)}`.trim(), "done");
    } catch (error) {
      setBossStatus(error.command ? statusMessageFor(error.command) : t("requestFailed"), "error");
    } finally {
      bossApplying = false;
      automationRunning = false;
      renderBossModal();
      renderBridgeStatus();
    }
  }

  async function loadCharacterStats() {
    characterLoading = true;
    characterWarning = null;
    renderCharacterModal();
    try {
      const response = await fetch("/api/cheat-automations/character-stats", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.fields)) throw new Error(result.code || "CHARACTER_STATS_LOOKUP_FAILED");
      characterFields = result.fields;
      characterReadable = Boolean(result.readable);
      characterWarning = result.warning || null;
      characterDraft.clear();
      for (const field of characterFields) {
        characterDraft.set(field.key, characterReadable && Number.isSafeInteger(field.value) ? String(field.value) : "");
      }
      if (characterReadable) recalculateCharacterLevel();
    } catch (error) {
      characterReadable = false;
      characterWarning = String(error.message || error);
    } finally {
      characterLoading = false;
      renderCharacterModal();
    }
  }

  function openCharacterModal() {
    characterModalOpen = true;
    characterStatusMessage = "";
    characterStatusType = "";
    renderCharacterModal();
    const dialog = panel.querySelector("#cheatAutomationCharacterDialog");
    if (dialog && !dialog.open) dialog.showModal();
    loadCharacterStats();
  }

  function closeCharacterModal() {
    if (characterApplying) return;
    characterModalOpen = false;
    const dialog = panel.querySelector("#cheatAutomationCharacterDialog");
    if (dialog?.open) dialog.close();
  }

  function resetCharacterDraft() {
    for (const field of characterFields) {
      const value = characterReadable && Number.isSafeInteger(field.value) ? String(field.value) : "";
      characterDraft.set(field.key, value);
      const input = panel.querySelector(`input[data-role="character-stat"][data-stat-key="${field.key}"]`);
      if (input) input.value = value;
    }
    if (characterReadable) recalculateCharacterLevel();
    setCharacterStatus("", "");
    updateCharacterModalControls();
  }

  async function applyCharacterStats() {
    const changes = characterChanges();
    if (changes.invalid) {
      setCharacterStatus(t("characterStatsInvalid"), "error");
      return;
    }
    if (!changes.count) {
      setCharacterStatus(t("characterStatsChooseOne"), "error");
      return;
    }
    if (!bridgeConnected && !(await refreshBridgeStatus())) {
      setCharacterStatus(t("bridgeOffline"), "error");
      return;
    }

    characterApplying = true;
    automationRunning = true;
    setCharacterStatus(t("characterStatsApplying"), "pending");
    renderCharacterModal();
    updateSelectionState();
    try {
      const response = await fetch("/api/cheat-automations/character-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: changes.values, backup: backupRequested })
      });
      const result = await response.json();
      if (!response.ok || !result.command) {
        if (result.code === "INVALID_CHARACTER_STAT") {
          setCharacterStatus(t("characterStatsInvalid"), "error");
          return;
        }
        throw new Error(result.code || "COMMAND_SEND_FAILED");
      }
      consumeBackupOption();
      const command = await waitForCommand(result.command.id);
      await loadCharacterStats();
      setCharacterStatus(`${t("characterStatsApplied")(changes.count)} ${backupMessage(command.backup)}`.trim(), "done");
    } catch (error) {
      setCharacterStatus(error.command ? statusMessageFor(error.command) : t("requestFailed"), "error");
    } finally {
      characterApplying = false;
      automationRunning = false;
      renderCharacterModal();
      renderBridgeStatus();
    }
  }

  async function loadInvincibility() {
    if (invincibilityLoading) return;
    invincibilityLoading = true;
    invincibilityWarning = null;
    renderInvincibility();
    try {
      const response = await fetch("/api/cheat-automations/invincibility", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.fields)) throw new Error(result.code || "INVINCIBILITY_LOOKUP_FAILED");
      invincibilityFields = result.fields;
      invincibilityReadable = Boolean(result.readable);
      invincibilityWarning = result.warning || null;
      invincibilityDraft.clear();
      for (const field of invincibilityFields) {
        if (invincibilityReadable && typeof field.enabled === "boolean") {
          invincibilityDraft.set(field.key, field.enabled);
        }
      }
    } catch (error) {
      invincibilityReadable = false;
      invincibilityWarning = String(error.message || error);
    } finally {
      invincibilityLoaded = true;
      invincibilityLoading = false;
      renderInvincibility();
    }
  }

  async function applyInvincibility() {
    const values = invincibilityChanges();
    const changeCount = Object.keys(values).length;
    if (!changeCount) {
      setInvincibilityStatus(t("invincibilityNoChanges"), "error");
      return;
    }
    if (!bridgeConnected && !(await refreshBridgeStatus())) {
      setInvincibilityStatus(t("bridgeOffline"), "error");
      return;
    }

    invincibilityApplying = true;
    automationRunning = true;
    setInvincibilityStatus(t("invincibilityApplying"), "pending");
    renderInvincibility();
    updateSelectionState();
    try {
      const response = await fetch("/api/cheat-automations/invincibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values })
      });
      const result = await response.json();
      if (!response.ok || !result.command) throw new Error(result.code || "COMMAND_SEND_FAILED");
      const command = await waitForCommand(result.command.id);
      await loadInvincibility();
      setInvincibilityStatus(t("invincibilityApplied")(changeCount), "done");
      if (command.resultCode !== "INVINCIBILITY_UPDATED") {
        throw Object.assign(new Error("COMMAND_FAILED"), { command });
      }
    } catch (error) {
      setInvincibilityStatus(error.command ? statusMessageFor(error.command) : t("requestFailed"), "error");
    } finally {
      invincibilityApplying = false;
      automationRunning = false;
      renderInvincibility();
      renderBridgeStatus();
    }
  }

  panel.addEventListener("change", event => {
    if (event.target.id === "cheatAutomationBossFilter") {
      bossFilter = event.target.value;
      renderBossRows();
      return;
    }
    if (event.target.matches('select[data-role="boss-target"]')) {
      const id = event.target.dataset.bossId;
      if (bossTargets.has(id) && (event.target.value === "alive" || event.target.value === "dead")) {
        bossTargets.set(id, event.target.value);
        setBossStatus("", "");
        updateBossModalControls();
      }
      return;
    }
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) return;
    if (checkbox.dataset.role === "invincibility") {
      const key = checkbox.dataset.invincibilityKey;
      if (invincibilityDefinitions().some(field => field.key === key)) {
        invincibilityDraft.set(key, checkbox.checked);
        setInvincibilityStatus("", "");
        updateInvincibilityControls();
      }
      return;
    } else if (checkbox.dataset.role === "backup") {
      backupRequested = checkbox.checked;
    } else if (checkbox.dataset.role === "boss-backup") {
      backupRequested = checkbox.checked;
      const pageBackup = panel.querySelector('input[data-role="backup"]');
      if (pageBackup) pageBackup.checked = backupRequested;
    } else if (checkbox.dataset.role === "character-backup") {
      backupRequested = checkbox.checked;
      const pageBackup = panel.querySelector('input[data-role="backup"]');
      if (pageBackup) pageBackup.checked = backupRequested;
    } else if (checkbox.dataset.role === "boss-select") {
      const boss = bossList.find(item => item.id === checkbox.value);
      if (checkbox.checked && boss) bossTargets.set(boss.id, boss.dead === true ? "alive" : "dead");
      else bossTargets.delete(checkbox.value);
      setBossStatus("", "");
      renderBossRows();
      return;
    } else if (checkbox.dataset.role === "automation") {
      if (checkbox.checked) selectedIds.add(checkbox.value);
      else selectedIds.delete(checkbox.value);
    }
    setStatus("", "");
    updateSelectionState();
  });

  panel.addEventListener("input", event => {
    if (event.target.matches('input[data-role="character-stat"]')) {
      characterDraft.set(event.target.dataset.statKey, event.target.value);
      if (event.target.dataset.statKey !== "level") recalculateCharacterLevel();
      setCharacterStatus("", "");
      updateCharacterModalControls();
      return;
    }
    if (event.target.id === "cheatAutomationBossSearch") {
      bossSearch = event.target.value;
      renderBossRows();
      return;
    }
    if (event.target.id === "cheatAutomationRuneAmount") {
      runeAmount = event.target.value;
      setStatus("", "");
      updateSelectionState();
    }
    if (event.target.id === "cheatAutomationItemQuantity") {
      itemQuantity = event.target.value;
      setStatus("", "");
      updateSelectionState();
    }
    if (event.target.id === "cheatAutomationItemSearch") {
      itemQuery = event.target.value;
      if (selectedItem && itemQuery !== selectedItem.name) {
        selectedItem = null;
        renderSelectedItem();
      }
      setStatus("", "");
      scheduleItemSearch();
    }
  });

  panel.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "back") window.location.href = "/control.html";
    if (button.dataset.action === "apply") applySelectedAutomations();
    if (button.dataset.action === "add-runes") addRunes();
    if (button.dataset.action === "add-item") addItem();
    if (button.dataset.action === "select-item") selectItem(Number(button.dataset.resultIndex));
    if (button.dataset.action === "open-bosses") openBossModal();
    if (button.dataset.action === "close-bosses") closeBossModal();
    if (button.dataset.action === "refresh-bosses") loadBossStates();
    if (button.dataset.action === "boss-set-alive") setSelectedBossTarget("alive");
    if (button.dataset.action === "boss-set-dead") setSelectedBossTarget("dead");
    if (button.dataset.action === "apply-bosses") applyBossChanges();
    if (button.dataset.action === "open-character-stats") openCharacterModal();
    if (button.dataset.action === "close-character-stats") closeCharacterModal();
    if (button.dataset.action === "refresh-character-stats") loadCharacterStats();
    if (button.dataset.action === "reset-character-stats") resetCharacterDraft();
    if (button.dataset.action === "apply-character-stats") applyCharacterStats();
    if (button.dataset.action === "refresh-invincibility") loadInvincibility();
    if (button.dataset.action === "apply-invincibility") applyInvincibility();
  });

  panel.addEventListener("cancel", event => {
    if (event.target.id !== "cheatAutomationBossDialog") return;
    event.preventDefault();
    closeBossModal();
  });

  panel.addEventListener("cancel", event => {
    if (event.target.id !== "cheatAutomationCharacterDialog") return;
    event.preventDefault();
    closeCharacterModal();
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(bridgeCheckTimer);
    clearTimeout(itemSearchTimer);
    itemSearchSequence += 1;
  });

  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) {
    languageSelect.addEventListener("change", () => {
      renderStaticCopy();
      renderPage();
      renderBridgeStatus();
    });
  }

  renderStaticCopy();
  renderPage();
  refreshBridgeStatus();
  bridgeCheckTimer = setInterval(refreshBridgeStatus, 1500);
})();
