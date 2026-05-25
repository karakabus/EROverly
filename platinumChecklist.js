function manual(id, group, titleEn, titleTr, requirementEn, requirementTr) {
  return {
    id,
    group,
    type: group,
    source: "manual",
    countsForPlatinum: true,
    title: { en: titleEn, tr: titleTr },
    requirement: { en: requirementEn, tr: requirementTr }
  };
}

function boss(id, group, bossId, titleEn, titleTr, requirementEn, requirementTr) {
  return {
    id,
    group,
    type: "boss",
    source: "auto",
    countsForPlatinum: true,
    bossId,
    title: { en: titleEn, tr: titleTr },
    requirement: { en: requirementEn, tr: requirementTr }
  };
}

const BASE_PLATINUM_ITEMS = [
  manual("ending-elden-lord", "ending", "Elden Lord", "Elden Lord", "Achieve the Elden Lord ending.", "Elden Lord sonuna ulaş."),
  manual("ending-age-of-stars", "ending", "Age of the Stars", "Age of the Stars", "Achieve the Age of the Stars ending.", "Age of the Stars sonuna ulaş."),
  manual("ending-frenzied-flame", "ending", "Lord of Frenzied Flame", "Lord of Frenzied Flame", "Achieve the Lord of Frenzied Flame ending.", "Lord of Frenzied Flame sonuna ulaş."),

  boss("shardbearer-godrick", "shardbearer", "2:1", "Shardbearer Godrick", "Shardbearer Godrick", "Defeat Godrick the Grafted.", "Godrick the Grafted bossunu yen."),
  boss("shardbearer-radahn", "shardbearer", "6:14", "Shardbearer Radahn", "Shardbearer Radahn", "Defeat Starscourge Radahn.", "Starscourge Radahn bossunu yen."),
  boss("shardbearer-morgott", "shardbearer", "12:4", "Shardbearer Morgott", "Shardbearer Morgott", "Defeat Morgott, the Omen King.", "Morgott, the Omen King bossunu yen."),
  boss("shardbearer-rykard", "shardbearer", "11:2", "Shardbearer Rykard", "Shardbearer Rykard", "Defeat Rykard, Lord of Blasphemy.", "Rykard, Lord of Blasphemy bossunu yen."),
  boss("shardbearer-malenia", "shardbearer", "17:1", "Shardbearer Malenia", "Shardbearer Malenia", "Defeat Malenia, Goddess of Rot.", "Malenia, Goddess of Rot bossunu yen."),
  boss("shardbearer-mohg", "shardbearer", "19:0", "Shardbearer Mohg", "Shardbearer Mohg", "Defeat Mohg, Lord of Blood.", "Mohg, Lord of Blood bossunu yen."),

  boss("boss-maliketh", "legendaryFoe", "15:2", "Maliketh the Black Blade", "Maliketh the Black Blade", "Defeat Maliketh the Black Blade.", "Maliketh the Black Blade bossunu yen."),
  boss("boss-hoarah-loux", "legendaryFoe", "22:1", "Hoarah Loux, Warrior", "Hoarah Loux, Warrior", "Defeat Hoarah Loux, Warrior.", "Hoarah Loux, Warrior bossunu yen."),
  boss("boss-dragonlord-placidusax", "legendaryFoe", "15:1", "Dragonlord Placidusax", "Dragonlord Placidusax", "Defeat Dragonlord Placidusax.", "Dragonlord Placidusax bossunu yen."),

  manual("upgrade-god-slaying-armament", "collection", "God-Slaying Armament", "God-Slaying Armament", "Upgrade any armament to its highest stage.", "Herhangi bir silahı en yüksek seviyeye yükselt."),
  manual("collection-legendary-armaments", "collection", "Legendary Armaments", "Legendary Armaments", "Acquire all legendary armaments.", "Tüm legendary armamentları topla."),
  manual("collection-legendary-ashen-remains", "collection", "Legendary Ashen Remains", "Legendary Ashen Remains", "Acquire all legendary ashen remains.", "Tüm legendary ashen remains itemlerini topla."),
  manual("collection-legendary-sorceries-incantations", "collection", "Legendary Sorceries and Incantations", "Legendary Sorceries and Incantations", "Acquire all legendary sorceries and incantations.", "Tüm legendary sorcery ve incantationları topla."),
  manual("collection-legendary-talismans", "collection", "Legendary Talismans", "Legendary Talismans", "Acquire all legendary talismans.", "Tüm legendary talismanları topla."),

  boss("boss-rennala", "greaterFoe", "5:1", "Rennala, Queen of the Full Moon", "Rennala, Queen of the Full Moon", "Defeat Rennala, Queen of the Full Moon.", "Rennala, Queen of the Full Moon bossunu yen."),
  boss("boss-lichdragon-fortissax", "greaterFoe", "21:2", "Lichdragon Fortissax", "Lichdragon Fortissax", "Defeat Lichdragon Fortissax.", "Lichdragon Fortissax bossunu yen."),
  boss("boss-godskin-duo", "greaterFoe", "15:0", "Godskin Duo", "Godskin Duo", "Defeat Godskin Duo.", "Godskin Duo bossunu yen."),
  boss("boss-fire-giant", "greaterFoe", "14:8", "Fire Giant", "Fire Giant", "Defeat Fire Giant.", "Fire Giant bossunu yen."),
  boss("boss-dragonkin-nokstella", "greaterFoe", "20:0", "Dragonkin Soldier of Nokstella", "Dragonkin Soldier of Nokstella", "Defeat Dragonkin Soldier of Nokstella.", "Dragonkin Soldier of Nokstella bossunu yen."),
  boss("boss-regal-ancestor-spirit", "greaterFoe", "18:3", "Regal Ancestor Spirit", "Regal Ancestor Spirit", "Defeat Regal Ancestor Spirit.", "Regal Ancestor Spirit bossunu yen."),
  boss("boss-valiant-gargoyles", "greaterFoe", "18:4", "Valiant Gargoyles", "Valiant Gargoyles", "Defeat Valiant Gargoyles.", "Valiant Gargoyles bossunu yen."),
  boss("boss-margit", "greaterFoe", "2:0", "Margit, the Fell Omen", "Margit, the Fell Omen", "Defeat Margit, the Fell Omen.", "Margit, the Fell Omen bossunu yen."),
  boss("boss-red-wolf-radagon", "greaterFoe", "5:0", "Red Wolf of Radagon", "Red Wolf of Radagon", "Defeat Red Wolf of Radagon.", "Red Wolf of Radagon bossunu yen."),
  boss("boss-godskin-noble", "greaterFoe", "11:1", "Godskin Noble", "Godskin Noble", "Defeat Godskin Noble.", "Godskin Noble bossunu yen."),
  boss("boss-magma-wyrm-makar", "greaterFoe", "3:24", "Magma Wyrm Makar", "Magma Wyrm Makar", "Defeat Magma Wyrm Makar.", "Magma Wyrm Makar bossunu yen."),
  boss("boss-godfrey-first-elden-lord", "greaterFoe", "12:3", "Godfrey, First Elden Lord", "Godfrey, First Elden Lord", "Defeat Godfrey, First Elden Lord.", "Godfrey, First Elden Lord bossunu yen."),
  boss("boss-mohg-the-omen", "greaterFoe", "12:2", "Mohg, the Omen", "Mohg, the Omen", "Defeat Mohg, the Omen.", "Mohg, the Omen bossunu yen."),
  boss("boss-mimic-tear", "greaterFoe", "18:2", "Mimic Tear", "Mimic Tear", "Defeat Mimic Tear.", "Mimic Tear bossunu yen."),
  boss("boss-loretta-haligtree", "greaterFoe", "17:0", "Loretta, Knight of the Haligtree", "Loretta, Knight of the Haligtree", "Defeat Loretta, Knight of the Haligtree.", "Loretta, Knight of the Haligtree bossunu yen."),
  boss("boss-astel-naturalborn", "greaterFoe", "20:2", "Astel, Naturalborn of the Void", "Astel, Naturalborn of the Void", "Defeat Astel, Naturalborn of the Void.", "Astel, Naturalborn of the Void bossunu yen."),
  boss("boss-leonine-misbegotten", "greaterFoe", "1:9", "Leonine Misbegotten", "Leonine Misbegotten", "Defeat Leonine Misbegotten.", "Leonine Misbegotten bossunu yen."),
  boss("boss-royal-knight-loretta", "greaterFoe", "3:23", "Royal Knight Loretta", "Royal Knight Loretta", "Defeat Royal Knight Loretta.", "Royal Knight Loretta bossunu yen."),
  boss("boss-elemer-of-the-briar", "greaterFoe", "8:19", "Elemer of the Briar", "Elemer of the Briar", "Defeat Elemer of the Briar.", "Elemer of the Briar bossunu yen."),
  boss("boss-ancestor-spirit", "greaterFoe", "18:1", "Ancestor Spirit", "Ancestor Spirit", "Defeat Ancestor Spirit.", "Ancestor Spirit bossunu yen."),
  boss("boss-commander-niall", "greaterFoe", "14:7", "Commander Niall", "Commander Niall", "Defeat Commander Niall.", "Commander Niall bossunu yen."),

  manual("misc-roundtable-hold", "misc", "Roundtable Hold", "Roundtable Hold", "Arrive at Roundtable Hold.", "Roundtable Hold'a ulaş."),
  manual("misc-great-rune", "misc", "Great Rune", "Great Rune", "Restore the power of a Great Rune.", "Bir Great Rune gücünü restore et."),
  manual("misc-erdtree-aflame", "misc", "Erdtree Aflame", "Erdtree Aflame", "Use kindling to set the Erdtree aflame.", "Kindling kullanarak Erdtree'yi yak.")
];

const MANUAL_PLATINUM_ITEM_IDS = new Set(
  BASE_PLATINUM_ITEMS.filter(item => item.source === "manual").map(item => item.id)
);

module.exports = {
  BASE_PLATINUM_ITEMS,
  MANUAL_PLATINUM_ITEM_IDS
};
