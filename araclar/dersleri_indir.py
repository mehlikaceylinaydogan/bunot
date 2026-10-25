# -*- coding: utf-8 -*-
"""
Bogazici Universitesi ders programindan tum dersleri indirir.
Calistirmak icin: python bu dosya
Sonuc: site/veri/dersler.json
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEDEF = os.path.join(KOK, "site", "veri", "dersler.json")
TABAN = "https://registration.boun.edu.tr"

# Bolum adlari okulun kendi dilinde (Ingilizce) birakilir; cevrilmez.


def indir(url, deneme=3):
    for i in range(deneme):
        try:
            istek = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (ders-notlari-sitesi)",
                "Accept-Charset": "iso-8859-9,utf-8",
            })
            with urllib.request.urlopen(istek, timeout=30) as yanit:
                ham = yanit.read()
            try:
                return ham.decode("iso-8859-9")
            except Exception:
                return ham.decode("utf-8", "replace")
        except Exception as hata:
            if i == deneme - 1:
                raise
            time.sleep(1.5)
    return ""


def temizle(parca):
    parca = re.sub(r"(?is)<script.*?</script>", " ", parca)
    parca = re.sub(r"(?s)<[^>]+>", " ", parca)
    parca = html.unescape(parca).replace("\xa0", " ")
    return re.sub(r"\s+", " ", parca).strip()


def bolumleri_bul(sayfa):
    bulunan = []
    for m in re.finditer(r'href="/scripts/sch\.asp\?donem=[^"]*?kisaadi=([^&"]+)&bolum=([^"]+)"', sayfa):
        kisa = urllib.parse.unquote_plus(m.group(1))
        ad = urllib.parse.unquote_plus(m.group(2))
        if (kisa, ad) not in bulunan:
            bulunan.append((kisa, ad))
    return bulunan


def satirlari_bul(sayfa):
    dersler = []
    donem = ""
    m = re.search(r"Semester\s*:?\s*</td>\s*<td[^>]*>([^<]+)</td>", sayfa, re.I)
    if m:
        donem = m.group(1).strip()
    for blok in re.split(r'(?i)<tr class="schtd', sayfa)[1:]:
        kod_m = re.search(r"<font style='font-size:12px'>\s*([^<]+?)\s*</font>", blok)
        if not kod_m:
            continue
        tam_kod = kod_m.group(1).strip()
        hucreler = re.findall(r"(?is)<td[^>]*>(.*?)</td>", blok)
        if len(hucreler) < 5:
            continue
        ad = temizle(hucreler[2])
        kredi = temizle(hucreler[3])
        ects = temizle(hucreler[4])
        hoca = temizle(hucreler[6]) if len(hucreler) > 6 else ""
        kod_m2 = re.match(r"([A-ZÇĞİÖŞÜ]+)\s*(\d+[A-Z]?)", tam_kod)
        if not kod_m2:
            continue
        kod = kod_m2.group(1) + " " + kod_m2.group(2)
        dersler.append({
            "kod": kod,
            "ad": ad,
            "kredi": int(kredi) if kredi.isdigit() else None,
            "ects": int(ects) if ects.isdigit() else None,
            "hoca": hoca,
        })
    return donem, dersler


def main():
    print("Bolum listesi aliniyor...")
    ana = indir(TABAN + "/scripts/schdepsel.asp")
    bolumler = bolumleri_bul(ana)
    print(f"{len(bolumler)} bolum bulundu.")

    ders_havuzu = {}
    bolum_bilgi = {}
    onek_bolum = {}
    donem = ""

    for sira, (kisa, ad) in enumerate(bolumler, 1):
        url = TABAN + "/scripts/sch.asp?donem=&kisaadi=" + urllib.parse.quote(kisa) + "&bolum=" + urllib.parse.quote_plus(ad)
        try:
            sayfa = indir(url)
        except Exception as hata:
            print(f"  ! {ad}: {hata}")
            continue
        sayfa_donem, satirlar = satirlari_bul(sayfa)
        if sayfa_donem:
            donem = sayfa_donem
        bolum_bilgi.setdefault(kisa, {"kod": kisa, "ad": ad})
        for s in satirlar:
            anahtar = s["kod"]
            onek_bolum.setdefault(anahtar.split()[0], ad)
            if anahtar in ders_havuzu:
                d = ders_havuzu[anahtar]
                d["sube"] = d.get("sube", 0) + 1
                if s["hoca"] and s["hoca"] not in d["hocalar"]:
                    d["hocalar"].append(s["hoca"])
                if not d["ad"] and s["ad"]:
                    d["ad"] = s["ad"]
            else:
                ders_havuzu[anahtar] = {
                    "kod": anahtar,
                    "ad": s["ad"],
                    "kredi": s["kredi"],
                    "ects": s["ects"],
                    "bolum": kisa,
                    "hocalar": [s["hoca"]] if s["hoca"] else [],
                    "sube": 1,
                }
        print(f"  [{sira}/{len(bolumler)}] {ad}: {len(satirlar)} sube")
        time.sleep(0.15)

    def siralama(d):
        onek = d["kod"].split()[0]
        sayi = re.sub(r"\D", "", d["kod"].split()[1]) if len(d["kod"].split()) > 1 else "0"
        return (onek, int(sayi or 0), d["kod"])

    dersler = sorted(ders_havuzu.values(), key=siralama)

    # Ders kodunun on eki, ait oldugu bolumu belirler
    for d in dersler:
        onek = d["kod"].split()[0]
        if onek not in bolum_bilgi:
            bolum_bilgi[onek] = {"kod": onek, "ad": onek_bolum.get(onek, onek)}
        d["bolum"] = onek
        # tekrar eden hoca adlarini temizle
        d["hocalar"] = sorted({h for h in d["hocalar"] if h})

    for b in bolum_bilgi.values():
        b["dersSayisi"] = sum(1 for d in dersler if d["bolum"] == b["kod"])

    # Dersi olmayan bolumleri listeden cikar
    bolumler = [b for b in bolum_bilgi.values() if b["dersSayisi"] > 0]

    veri = {
        "donem": donem or "2026/2027-1",
        "guncelleme": time.strftime("%Y-%m-%d"),
        "kaynak": "registration.boun.edu.tr",
        "bolumler": sorted(bolumler, key=lambda b: b["ad"]),
        "dersler": dersler,
    }

    os.makedirs(os.path.dirname(HEDEF), exist_ok=True)
    with open(HEDEF, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)

    print(f"\n{len(dersler)} ders, {len(bolum_bilgi)} bolum yazildi: {HEDEF}")
    print(f"Donem: {veri['donem']}")


if __name__ == "__main__":
    sys.exit(main())
