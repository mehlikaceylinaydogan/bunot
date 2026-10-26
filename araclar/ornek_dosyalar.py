# Deneme modu için örnek not dosyalarını üretir (bir kez çalıştırılır).
# Çıktı: araclar/ornek-dosyalar/*.pdf ve *.png
# Kullanım: python araclar/ornek_dosyalar.py
import os
import subprocess
import sys
import tempfile

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIKTI = os.path.join(KOK, "araclar", "ornek-dosyalar")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

NOTLAR = [
    {
        "slug": "cmpe150-vize",
        "kod": "CMPE 150",
        "tur": "Midterm",
        "baslik": "Değişkenler, döngüler, fonksiyonlar",
        "renk": "#2563eb",
        "bolumler": [
            ("Tipler", [
                "int, float, str, bool — hangisi neyi tutar",
                "str + int doğrudan toplanmaz: int(metin) ya da str(sayi)",
                "None: değer yok demek, 0 ile karıştırma",
            ]),
            ("Döngüler", [
                "for i in range(3): 0, 1, 2 yazar — 3 dahil değil",
                "while True: döngüden çıkmak için break",
                "continue: o turu atla, döngü devam etsin",
            ]),
            ("Fonksiyonlar", [
                "def topla(a, b): return a + b",
                "Varsayılan değer: def selam(ad=\"dünya\")",
                "Fonksiyon içinde tanımlanan değişken dışarıda görünmez",
            ]),
            ("Sınavda çıkan üç soru tipi", [
                "1) Verilen döngünün kaç kez döndüğünü yaz",
                "2) Fonksiyonun çıktısını tahmin et",
                "3) Küçük bir programı tamamla (5–8 satır)",
            ]),
        ],
    },
    {
        "slug": "math101-turev",
        "kod": "MATH 101",
        "tur": "Summary",
        "baslik": "Türev formülleri ve çözümlü örnekler",
        "renk": "#7c3aed",
        "bolumler": [
            ("Temel kurallar", [
                "(x^n)' = n·x^(n-1)",
                "(sin x)' = cos x,  (cos x)' = -sin x",
                "(e^x)' = e^x,  (ln x)' = 1/x",
            ]),
            ("Çarpım ve bölüm", [
                "(u·v)' = u'v + uv'",
                "(u/v)' = (u'v - uv') / v²",
                "Örnek: (x²·sin x)' = 2x·sin x + x²·cos x",
            ]),
            ("Zincir kuralı", [
                "(f(g(x)))' = f'(g(x))·g'(x)",
                "Örnek: (sin(3x))' = 3·cos(3x)",
                "Örnek: (e^(x²))' = 2x·e^(x²)",
            ]),
            ("Logaritmik türev", [
                "y = f(x)^g(x) ise ln y = g(x)·ln f(x)",
                "İki tarafı türet, sonra y'yi yalnız bırak",
                "Örnek: y = x^x → y' = x^x·(ln x + 1)",
            ]),
        ],
    },
    {
        "slug": "phys201-final",
        "kod": "PHYS 201",
        "tur": "Final",
        "baslik": "Elektrik alan soruları — çalışma kâğıdı",
        "renk": "#0d9488",
        "bolumler": [
            ("Hatırlatma", [
                "Coulomb: F = k·q1·q2 / r²",
                "Elektrik alan: E = F / q,  nokta yük için E = k·q / r²",
                "Süperpozisyon: alanlar vektör olarak toplanır",
            ]),
            ("Soru 1–3", [
                "1) İki nokta yük arasındaki kuvvetin yönü ve büyüklüğü",
                "2) Bir çubuk üzerinde alan integrali (λ sabit)",
                "3) Halka merkezinde alan: simetriden dolayı sıfır",
            ]),
            ("Soru 4–6", [
                "4) Gauss yasası: küre içinde ve dışında alan",
                "5) Sonsuz levha: E = σ / (2ε₀)",
                "6) Yüklü parçacığın alan içinde ivmesi",
            ]),
            ("Cevap anahtarı", [
                "1) F = k·q1·q2/r², yön: zıt yükler çeker",
                "2) E = k·λ·(sin θ1 + sin θ2) / d",
                "4) İçeride E ∝ r, dışarıda E ∝ 1/r²",
            ]),
        ],
    },
    {
        "slug": "ec101-vize",
        "kod": "EC 101",
        "tur": "Midterm",
        "baslik": "Vize soru tipleri ve grafik özeti",
        "renk": "#db2777",
        "bolumler": [
            ("Arz–talep", [
                "Talep eğrisi sağa kayarsa fiyat ve miktar artar",
                "Arz sola kayarsa fiyat artar, miktar düşer",
                "Denge: Qd = Qs",
            ]),
            ("Esneklik", [
                "|Ed| > 1 esnek, < 1 esnek değil",
                "Ed = (ΔQ/Q) / (ΔP/P)",
                "Toplam gelir testi: esnekse fiyat düşünce gelir artar",
            ]),
            ("Tüketici artığı", [
                "Ödemeye razı olunan fiyat ile ödenen fiyat arasındaki alan",
                "Vergi koyunca artığın bir kısmı devlete gider",
                "Ölü ağırlık kaybı: vergi sonrası küçülen alan",
            ]),
            ("Grafik okuma sırası", [
                "1) Eksenleri etiketle  2) Kaymayı göster",
                "3) Yeni dengeyi işaretle  4) Alanı tarayıp yorumla",
            ]),
        ],
    },
    {
        "slug": "chem105-lab",
        "kod": "CHEM 105",
        "tur": "Other",
        "baslik": "Lab raporu şablonu (deney 3)",
        "renk": "#ea580c",
        "bolumler": [
            ("Başlık ve amaç", [
                "Deney adı, tarih, ad soyad, grup numarası",
                "Tek cümle: bu deneyde ne ölçüldü, neden",
            ]),
            ("Yöntem", [
                "Kullanılan kimyasallar ve miktarları",
                "Adım adım kısa işlem sırası (geçmiş zaman)",
                "Kullanılan araçlar: buret, erlen, ısıtıcı",
            ]),
            ("Veri ve hesap", [
                "Ölçüm tablosu: deneme 1–2–3, ortalama",
                "Hesaplama adımları, birimlerle",
                "Sonuç: beklenen değer ile karşılaştırma",
            ]),
            ("Hata analizi", [
                "Sistematik hata: kalibrasyon, saf olmayan kimyasal",
                "Rastgele hata: okuma hatası, sıcaklık dalgalanması",
                "Yüzde hata = |deneysel - kuramsal| / kuramsal × 100",
            ]),
        ],
    },
    {
        "slug": "soc101-okuma",
        "kod": "SOC 101",
        "tur": "Summary",
        "baslik": "Okuma notları: 1–4. hafta",
        "renk": "#4f46e5",
        "bolumler": [
            ("1. hafta — Sosyoloji nedir", [
                "Bireysel olayları toplumsal örüntüler içinde okumak",
                "Comte, Durkheim, Weber: kurucu isimler",
                "Sosyolojik imgelem: kişisel olanı toplumsalla ilişkilendirmek",
            ]),
            ("2. hafta — Kültür", [
                "Norm, değer, sembol, dil",
                "Kültürel görecelilik: başka kültürü kendi ölçütünle yargılamamak",
                "Alt kültür ve karşı kültür ayrımı",
            ]),
            ("3. hafta — Toplumsallaşma", [
                "Birincil (aile) ve ikincil (okul, iş) toplumsallaşma",
                "Benlik: Cooley'in ayna benlik kuramı, Mead'in 'ben' ve 'beni'",
                "Kurumların bireyi biçimlendirmesi",
            ]),
            ("4. hafta — Eşitsizlik", [
                "Sınıf, statü, hareketlilik",
                "Yapısal eşitsizlik: bireysel çabayla açıklanamaz",
                "Sınavda çıkan üç kavram: norm, toplumsallaşma, hareketlilik",
            ]),
        ],
    },
]

SABLON = """<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>{baslik}</title>
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: #fff; color: #17203a;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  }}
  .sayfa {{ width: 210mm; min-height: 297mm; padding: 18mm 17mm; }}
  .ust {{ display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }}
  .cip {{
    border: 1.5px solid {renk}; color: {renk};
    border-radius: 999px; padding: 3px 10px;
    font-size: 11px; font-weight: 700; letter-spacing: .04em;
  }}
  .tur {{ color: #6b7590; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }}
  h1 {{ font-size: 26px; line-height: 1.22; margin: 8px 0 4px; letter-spacing: -.01em; }}
  .cizgi {{ height: 3px; width: 64px; background: {renk}; border-radius: 3px; margin: 10px 0 20px; }}
  h2 {{
    font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
    color: {renk}; margin: 20px 0 7px;
  }}
  ul {{ margin: 0; padding-left: 17px; }}
  li {{ font-size: 12.5px; line-height: 1.62; margin-bottom: 3px; color: #2a3350; }}
  .dip {{
    margin-top: 26px; padding-top: 10px; border-top: 1px solid #e3e8f2;
    font-size: 10.5px; color: #8b94ab; display: flex; justify-content: space-between;
  }}
</style></head>
<body><div class="sayfa">
  <div class="ust"><span class="cip">{kod}</span><span class="tur">{tur}</span></div>
  <h1>{baslik}</h1>
  <div class="cizgi"></div>
  {govde}
  <div class="dip"><span>bunot · örnek not</span><span>{kod}</span></div>
</div></body></html>
"""


def html_uret(notu):
    govde = []
    for baslik, satirlar in notu["bolumler"]:
        govde.append("<h2>%s</h2><ul>%s</ul>" % (
            baslik, "".join("<li>%s</li>" % s for s in satirlar)))
    return SABLON.format(
        baslik=notu["baslik"], kod=notu["kod"], tur=notu["tur"],
        renk=notu["renk"], govde="\n  ".join(govde))


def uret(notu):
    os.makedirs(CIKTI, exist_ok=True)
    yol_html = os.path.join(tempfile.gettempdir(), "ornek-%s.html" % notu["slug"])
    with open(yol_html, "w", encoding="utf-8") as f:
        f.write(html_uret(notu))

    if notu["slug"] in ("math101-turev", "phys201-final", "chem105-lab"):
        hedef = os.path.join(CIKTI, notu["slug"] + ".pdf")
        subprocess.run([
            CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
            "--no-pdf-header-footer", "--virtual-time-budget=4000",
            "--print-to-pdf=" + hedef, "file:///" + yol_html.replace("\\", "/"),
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        hedef = os.path.join(CIKTI, notu["slug"] + ".png")
        subprocess.run([
            CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
            "--hide-scrollbars", "--window-size=794,1123",
            "--virtual-time-budget=4000", "--screenshot=" + hedef,
            "file:///" + yol_html.replace("\\", "/"),
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print("%-22s %7d bayt" % (os.path.basename(hedef), os.path.getsize(hedef)))


if __name__ == "__main__":
    if not os.path.exists(CHROME):
        sys.exit("Chrome bulunamadı: " + CHROME)
    for n in NOTLAR:
        uret(n)
