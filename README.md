# Elden Ring Challenge Overlay

Mac + OBS + CrossOver için oyun içine DLL inject etmeden çalışan HTML overlay ve control paneli.

## Çalıştırma

Terminal'de klasöre gir:

```bash
cd elden-ring-challenge-overlay
npm start
```

Açılacak adresler:

```text
Control: http://localhost:3210/control.html
Overlay: http://localhost:3210/overlay.html
```

## OBS kurulumu

OBS > Sources > + > Browser

URL:

```text
http://localhost:3210/overlay.html
```

Önerilen boyut:

```text
Width: 330
Height: 600
```

Sonra kaynağı sağ üst köşeye taşı.

## Kontrol

Tarayıcıda aç:

```text
http://localhost:3210/control.html
```

Kısayollar:

```text
Space  = Start / Pause
Enter  = Next Split
```

## CE'siz oyun otomasyonları

Control paneldeki `Otomasyonları Aç` bağlantısı `/automation` sayfasına gider. Bu sayfa şimdilik ana oyun/DLC haritaları, ana oyun/DLC Lütuf Noktaları, `Rune Ekle` ve `Eşya Ekle` işlemlerini sunar. Cheat Engine'in açık veya kurulu olması gerekmez.

Windows yardımcı programını bir kez derle:

```bash
npm run build:map-helper
```

Ardından Elden Ring'i Easy Anti-Cheat kapalı ve çevrimdışı olarak çalıştır. Otomasyon sayfası `Doğrudan oyun yardımcısı hazır` durumunu gösterdiğinde harita veya Lütuf Noktası gruplarını seçip `Uygula`; rune için miktarı girdikten sonra `Rune Ekle` düğmesini kullan. Eşya bölümünde ada veya CT kimliğine göre ara, sonuçlardan tek kayıt seç, adedi gir ve `Eşya Ekle` düğmesine bas.

Yardımcı program genel bir CT yorumlayıcısı değildir. `eldenring_all-in-one_Hexinton-v5.0_ce7.5.ct` dosyasını salt okunur kaynak olarak kullanır; yalnızca Hexinton tablosundaki ana oyun/DLC harita ve Lütuf Noktası event-flag gruplarını, `Add Runes` kaydının `WorldChrMan`/`AddSoul_Call` sözleşmesini ve ItemGib'in `22032400–22032404` arama listeleri ile `InventoryAccessor`/`AddItemFunc` sözleşmesini okur. Hexinton'un DLC harita grubunda eksik olan standart `ShowDLCMap` (`82002`, `FA0` bit `5`) görünürlük flag'i DLC haritaları işlemine ayrıca eklenir. Başka Lua veya Auto Assembler kayıtları çalıştırılmaz.

`Bu işlemden önce save yedeği al` seçeneği varsayılan olarak kapalıdır. İşaretlenirse yalnızca sıradaki işlemden önce canlı save `.runtime/save-backups/` altına zaman damgalı olarak kopyalanır ve SHA-256 ile doğrulanır; yedek alınamazsa o işlem oyun belleğine yazmaz.

Rune miktarı `1–999.999.999` aralığında tam sayı olmalıdır. Komut oyunun kendi `AddSoul` fonksiyonunu çağırır ve mevcut bakiye ile istenen miktarın toplamı `999.999.999` sınırını aşarsa işlemi reddeder.

Eşya araması silah/kalkan, zırh, tılsım, büyü/eşya ve Ash of War listelerini kapsar. Sunucu yalnızca arama sonucundan seçilen katalog anahtarını kabul eder; serbest ürün kimliği veya bellek adresi gönderilemez. Eşya adedi `1–999` aralığında tam sayı olmalıdır.

## Hotkey programı

Control paneldeki `Hotkey Programını Aç` bağlantısı ayrı `/hotkeys` sayfasına gider. Burada birden fazla makro oluşturulabilir; her makronun kendi `Aktif` switch'i, klavyeden kaydedilen tetikleyici kombinasyonu ve yukarıdan aşağıya çalışan eylem adımları vardır.

Eylem türleri:

- `Tuşa Bas`: girdiyi belirtilen milisaniye boyunca basıp bırakır.
- `Basılı Tut`: girdinin key-down durumunu gönderir.
- `Tuşu Bırak`: daha önce basılı tutulan aynı girdinin key-up durumunu gönderir.
- `Bekle`: sonraki adımdan önce belirtilen süre kadar bekler.

`Saldırı`, `Güçlü Saldırı`, `Etkileşim`, `Zıpla`, `Koş / Yuvarlan`, silah/eşya/büyü değiştirme gibi isimli oyun eylemleri varsayılan Elden Ring PC klavye/fare atamalarına çevrilir. Ham klavye ve fare tuşları da doğrudan seçilebilir. Oyun içi tuş atamaları değiştirilmişse şimdilik ham tuşlar kullanılmalıdır.

Hotkey servisi yalnızca Elden Ring ön plandayken çalışır ve Easy Anti-Cheat açıkken başlamayı reddeder. Makrolar kaydedildikten sonra sayfanın üstündeki ana servis düğmesiyle ayrıca başlatılır; yalnızca `Aktif` olan makrolar dinlenir. Tetikleyicide en son kaydedilen tuş çalıştırma tuşudur ve makro tetiklendiğinde oyuna ayrıca gönderilmez.

Varsayılanlar farklıysa şu değişkenler kullanılabilir:

```bash
ER_CROSSOVER_BOTTLE="Elden Ring" \
ER_CHEAT_TABLE_PATH="/path/to/Hexinton.ct" \
ER_LIVE_SAVE_PATH="/path/to/ER0000.sl2" \
npm start
```

## Save watcher

Save dosyası otomatik boss progress okumak için kullanılır. Kişisel save path dosyanı oluştur:

```bash
cp save_file_path.example.js save_file_path.js
```

Sonra `save_file_path.js` içindeki yolu kendi Elden Ring save klasörüne göre düzenle.

Alternatif olarak environment variable ile çalıştırabilirsin:

```bash
ER_SAVE_PATH="/path/to/ER0000.sl2" npm start
```

Control panelde `Save Dosyası Seç` düğmesiyle `.sl2` veya `.co2` dosyası seçilebilir. Tarayıcı gerçek dosya yolunu paylaşmadığı için seçilen dosya `.runtime/` altına kopyalanır ve watcher bu runtime kopyasını okur.

## Listeyi düzenleme

Control panelden `All Bosses`, `All Remembrances` ve `Custom Bosses` modları seçilebilir.
`Custom Bosses` modunda boss listesi checkbox'lı açılır listeden oluşturulur ve satır sırası yukarı/aşağı düğmeleriyle değiştirilebilir.

`state.json` dosyasındaki `tasks`, `rules` ve başlangıç ayarları elle de düzenlenebilir.

Düzenledikten sonra server'ı kapatıp tekrar aç:

```bash
Ctrl + C
npm start
```

## Not

`save_file_path.js` kişisel makine yolu içerdiği için Git'e eklenmez. Paylaşılabilir örnek dosya `save_file_path.example.js` içindedir.
