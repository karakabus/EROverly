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
