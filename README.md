# bunot

Boğaziçi Üniversitesi öğrencileri için ders notu paylaşım sitesi.

- **1472 ders**, tek arama kutusu (`tr109`, `TR 109`, `tr-109` hepsi bulunur)
- **30 lisans programı** için 8 dönemlik gerçek müfredat, giriş yılına göre
- Üyelik sadece `@boun.edu.tr` ve `@std.bogazici.edu.tr` adresleriyle
- Not yükleme, indirme, silme; tür (Midterm, Final, Quiz…) ve dönem bilgisi
- Açık/koyu tema, açılır-kapanır bölüm paneli, mobil uyumlu

## Çalıştırma (Windows)

1. Python 3 kurulu olmalı.
2. `Siteyi aç.vbs` dosyasına çift tıkla. Site `http://localhost:8765` adresinde açılır.

Sunucu yalnızca bu bilgisayarda çalışır; internete açık değildir.

## Klasörler

```
Siteyi aç.vbs          siteyi sessizce başlatır, tarayıcıyı açar
site/sunucu.py         küçük bir Python sunucusu (API + dosya sunumu)
site/sayfalar/         index.html, stil.css, uygulama.js, fontlar
site/veri/dersler.json ders kataloğu (2026/2027-1)
site/veri/mufredat.json bölüm müfredatları
site/veri/kisiler.json hesaplar        (repoya dahil değil)
site/veri/notlar.json  paylaşılan notlar (repoya dahil değil)
site/veri/dosyalar/    yüklenen dosyalar (repoya dahil değil)
```

Hesaplar ve yüklenen notlar kişisel veri olduğu için `.gitignore` ile dışarıda
tutulur. Şifreler düz metin değil, tuzlanmış SHA-256 özeti olarak saklanır.
