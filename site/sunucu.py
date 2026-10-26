# -*- coding: utf-8 -*-
"""
bunot — Boğaziçi ders notları.
Küçük site sunucusu. Dışarıdan hiçbir şey kurmak gerekmez, Python ile çalışır.

Başlatmak için:  Siteyi aç.vbs  (çift tıkla)
Elle:            python sunucu.py
"""
import base64
import hashlib
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KOK = os.path.dirname(os.path.abspath(__file__))
SAYFALAR = os.path.join(KOK, "sayfalar")
VERI = os.path.join(KOK, "veri")
DOSYALAR = os.path.join(VERI, "dosyalar")
YEDEKLER = os.path.join(KOK, "yedekler")
YEDEK_SAYISI = 14          # son 14 günün yedeği saklanır
KISILER = os.path.join(VERI, "kisiler.json")
NOTLAR = os.path.join(VERI, "notlar.json")
DERSLER = os.path.join(VERI, "dersler.json")
MUFREDAT = os.path.join(VERI, "mufredat.json")

PORT = 8765
AZAMI_DOSYA = 12 * 1024 * 1024      # 12 MB
AZAMI_GOVDE = 20 * 1024 * 1024

kilit = threading.RLock()
oturumlar = {}   # jeton -> kullanici id


# ---------------------------------------------------------------- veri katmanı

def oku(yol, varsayilan):
    try:
        with open(yol, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def yaz(yol, veri):
    # eski sürümü bir kenara koy (yanlışlıkla veri kaybına karşı)
    if os.path.isfile(yol):
        try:
            with open(yol, "rb") as f:
                eski = f.read()
            with open(yol + ".onceki", "wb") as f:
                f.write(eski)
        except Exception:
            pass
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
    os.replace(gecici, yol)
    if yol in (KISILER, NOTLAR):
        gunluk_yedek()


# ---------------------------------------------------------------- yedek
_son_yedek = None


def gunluk_yedek(zorla=False):
    """Günde bir kez verileri yedekler/ klasörüne kopyalar."""
    global _son_yedek
    bugun = time.strftime("%Y-%m-%d")
    if _son_yedek == bugun and not zorla:
        return
    try:
        hedef = os.path.join(YEDEKLER, bugun)
        os.makedirs(hedef, exist_ok=True)
        for ad in ("kisiler.json", "notlar.json", "dersler.json", "mufredat.json"):
            kaynak = os.path.join(VERI, ad)
            if os.path.isfile(kaynak):
                shutil.copy2(kaynak, os.path.join(hedef, ad))
        if os.path.isdir(DOSYALAR):
            hedef_dosya = os.path.join(hedef, "dosyalar")
            os.makedirs(hedef_dosya, exist_ok=True)
            for ad in os.listdir(DOSYALAR):
                kaynak = os.path.join(DOSYALAR, ad)
                varis = os.path.join(hedef_dosya, ad)
                if os.path.isfile(kaynak) and not os.path.exists(varis):
                    shutil.copy2(kaynak, varis)
        klasorler = sorted(
            d for d in os.listdir(YEDEKLER)
            if os.path.isdir(os.path.join(YEDEKLER, d))
        )
        for eski in klasorler[:-YEDEK_SAYISI]:
            shutil.rmtree(os.path.join(YEDEKLER, eski), ignore_errors=True)
        _son_yedek = bugun
    except Exception:
        pass


def hazirla():
    os.makedirs(DOSYALAR, exist_ok=True)
    for yol, varsayilan in ((KISILER, []), (NOTLAR, [])):
        if not os.path.exists(yol):
            yaz(yol, varsayilan)


hazirla()
katalog = oku(DERSLER, {"dersler": [], "bolumler": [], "donem": ""})
dersler = katalog.get("dersler", [])
ders_sozluk = {d["kod"]: d for d in dersler}
mufredat = oku(MUFREDAT, {})
kisiler = oku(KISILER, [])
notlar = oku(NOTLAR, [])
gunluk_yedek()


def sifre_ozeti(sifre, tuz):
    return hashlib.pbkdf2_hmac("sha256", sifre.encode("utf-8"), bytes.fromhex(tuz), 200_000).hex()


def kullanici_ozeti(k):
    ids = set(k.get("kaydedilenler") or [])
    kayit_sayisi = sum(1 for n in notlar if n["id"] in ids)
    return {"id": k["id"], "ad": k["ad"], "eposta": k["eposta"],
            "bolum": k.get("bolum", ""), "girisYili": k.get("girisYili", ""),
            "tarih": k["tarih"],
            "kayitSayisi": kayit_sayisi}


def not_ozeti(n, k=None):
    d = ders_sozluk.get(n["dersKodu"], {})
    begenenler = n.get("begenenler", [])
    kaydedilenler = (k or {}).get("kaydedilenler") or []
    return {
        "id": n["id"],
        "dersKodu": n["dersKodu"],
        "dersAdi": d.get("ad", ""),
        "baslik": n["baslik"],
        "tur": n["tur"],
        "donem": n["donem"],
        "aciklama": n["aciklama"],
        "dosyaAdi": n["dosyaAdi"],
        "boyut": n["boyut"],
        "yukleyen": n["yukleyenAd"],
        "yukleyenId": n["yukleyenId"],
        "tarih": n["tarih"],
        "indirme": n.get("indirme", 0),
        "begeni": len(begenenler),
        "begendim": bool(k and k["id"] in begenenler),
        "kaydettim": bool(k and n["id"] in kaydedilenler),
    }


# ---------------------------------------------------------------- yardımcılar

def gecerli_eposta(e):
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", e or ""))


def boun_epostasi(e):
    e = (e or "").lower()
    alan = e.split("@")[-1]
    return alan == "boun.edu.tr" or alan.endswith(".boun.edu.tr") \
        or alan == "bogazici.edu.tr" or alan.endswith(".bogazici.edu.tr")


def ad_anahtari(metin):
    """Adları karşılaştırmak için sadeleştirir: küçük harf, Türkçe harfler sade."""
    metin = (metin or "").strip().lower()
    for a, b in (("ı", "i"), ("\u0307", ""), ("ş", "s"), ("ğ", "g"),
                 ("ü", "u"), ("ö", "o"), ("ç", "c"), ("â", "a"), ("î", "i")):
        metin = metin.replace(a, b)
    return " ".join(metin.split())


# not türleri: tek liste, eş anlamlılar aynı kutuya toplanır (Vize = Midterm)
NOT_TURLERI = ("Midterm", "Final", "Quiz", "Homework", "Project", "Summary", "Other")
NOT_TUR_ESLERI = {
    "vize": "Midterm", "midterm exam": "Midterm", "midterm sinavi": "Midterm",
    "ara sinav": "Midterm", "vize sinavi": "Midterm", "1. vize": "Midterm", "2. vize": "Midterm",
    "final exam": "Final", "final sinavi": "Final", "finaller": "Final",
    "butunleme": "Final", "butunleme sinavi": "Final", "but": "Final",
    "resit": "Final", "make up": "Final",
    "quizler": "Quiz", "kisa sinav": "Quiz",
    "odev": "Homework", "odevler": "Homework", "homework": "Homework", "assignment": "Homework",
    "proje": "Project", "project": "Project",
    "ozet": "Summary", "summary": "Summary", "ders notu": "Summary", "notlar": "Summary",
    "diger": "Other", "other": "Other", "": "Other",
}


def tur_duzelt(metin):
    """Not türünü tek ve tutarlı bir ada çevirir; tanınmayan tür 'Other' olur."""
    anahtar = ad_anahtari(metin)
    for tur in NOT_TURLERI:
        if ad_anahtari(tur) == anahtar:
            return tur
    return NOT_TUR_ESLERI.get(anahtar, "Other")


class Isleyici(BaseHTTPRequestHandler):
    server_version = "bunot/1.0"

    # --- kolaylıklar -------------------------------------------------------
    def log_message(self, *args):
        pass

    def json_gonder(self, veri, kod=200, cerez=None):
        govde = json.dumps(veri, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(govde)))
        self.send_header("Cache-Control", "no-store")
        if cerez:
            self.send_header("Set-Cookie", cerez)
        self.end_headers()
        self.wfile.write(govde)

    def hata(self, mesaj, kod=400):
        self.json_gonder({"hata": mesaj}, kod)

    def govde_oku(self):
        uzunluk = int(self.headers.get("Content-Length") or 0)
        if uzunluk > AZAMI_GOVDE:
            raise ValueError("Gönderilen dosya çok büyük.")
        ham = self.rfile.read(uzunluk) if uzunluk else b""
        if not ham:
            return {}
        return json.loads(ham.decode("utf-8"))

    def cerezler(self):
        ham = self.headers.get("Cookie") or ""
        sonuc = {}
        for parca in ham.split(";"):
            if "=" in parca:
                a, b = parca.split("=", 1)
                sonuc[a.strip()] = b.strip()
        return sonuc

    def kullanici(self):
        jeton = self.cerezler().get("oturum")
        kid = oturumlar.get(jeton)
        if not kid:
            return None
        return next((k for k in kisiler if k["id"] == kid), None)

    # --- yönlendirme -------------------------------------------------------
    def do_GET(self):
        yol = urllib.parse.urlparse(self.path)
        if yol.path.startswith("/api/"):
            return self.api_get(yol.path[5:], urllib.parse.parse_qs(yol.query))
        return self.statik_gonder(yol.path)

    def do_POST(self):
        yol = urllib.parse.urlparse(self.path)
        if not yol.path.startswith("/api/"):
            return self.hata("Bulunamadı", 404)
        return self.api_post(yol.path[5:])

    def do_DELETE(self):
        yol = urllib.parse.urlparse(self.path)
        if not yol.path.startswith("/api/"):
            return self.hata("Bulunamadı", 404)
        return self.api_delete(yol.path[5:])

    # --- dosyalar ----------------------------------------------------------
    def statik_gonder(self, istek_yolu):
        if istek_yolu in ("", "/"):
            istek_yolu = "/index.html"
        yol = urllib.parse.unquote(istek_yolu).lstrip("/")
        tam = os.path.abspath(os.path.join(SAYFALAR, yol))
        if not tam.startswith(os.path.abspath(SAYFALAR)) or not os.path.isfile(tam):
            return self.hata("Bulunamadı", 404)
        tur = mimetypes.guess_type(tam)[0] or "application/octet-stream"
        if tur.startswith("text/") or tur in ("application/javascript", "application/json"):
            tur += "; charset=utf-8"
        with open(tam, "rb") as f:
            govde = f.read()
        self.send_response(200)
        self.send_header("Content-Type", tur)
        self.send_header("Content-Length", str(len(govde)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(govde)

    # --- GET uçları --------------------------------------------------------
    def api_get(self, uc, sorgu):
        if uc == "oturum":
            k = self.kullanici()
            return self.json_gonder({"kullanici": kullanici_ozeti(k) if k else None})

        if uc == "katalog":
            return self.json_gonder({
                "donem": katalog.get("donem", ""),
                "guncelleme": katalog.get("guncelleme", ""),
                "bolumler": katalog.get("bolumler", []),
                "dersler": dersler,
            })

        if uc == "notlar":
            ders = (sorgu.get("ders") or [""])[0]
            k = self.kullanici()
            with kilit:
                liste = [n for n in notlar if not ders or n["dersKodu"] == ders]
                liste = sorted(liste, key=lambda n: n["tarih"], reverse=True)
                return self.json_gonder({"notlar": [not_ozeti(n, k) for n in liste[:1000]]})

        if uc == "kaydettiklerim":
            k = self.kullanici()
            if not k:
                return self.hata("Kaydettiklerini görmek için giriş yapmalısın.", 401)
            with kilit:
                ids = k.get("kaydedilenler") or []
                liste = [not_ozeti(n, k) for n in notlar if n["id"] in ids]
            liste.sort(key=lambda x: x["tarih"], reverse=True)
            return self.json_gonder({"notlar": liste})

        if uc == "mufredat":
            with kilit:
                return self.json_gonder({"mufredat": mufredat})

        if uc == "sayilar":
            with kilit:
                return self.json_gonder({
                    "ders": len(dersler),
                    "bolum": len(katalog.get("bolumler", [])),
                    "not": len(notlar),
                    "kisi": len(kisiler),
                })

        if uc.startswith("indir/"):
            return self.dosya_gonder(uc[6:], indir=True)

        if uc.startswith("bak/"):
            return self.dosya_gonder(uc[4:], indir=False)

        return self.hata("Bulunamadı", 404)

    def dosya_gonder(self, not_id, indir=True):
        k = self.kullanici()
        if not k:
            return self.hata("Görmek için giriş yapmalısın.", 401)
        with kilit:
            n = next((x for x in notlar if x["id"] == not_id), None)
            if not n:
                return self.hata("Not bulunamadı.", 404)
            if indir:
                n["indirme"] = n.get("indirme", 0) + 1
                yaz(NOTLAR, notlar)
            yol = os.path.join(DOSYALAR, n["dosya"])
            adi = n["dosyaAdi"]
        if not os.path.isfile(yol):
            return self.hata("Dosya diskte bulunamadı.", 404)
        with open(yol, "rb") as f:
            govde = f.read()
        tur = mimetypes.guess_type(adi)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", tur)
        if indir:
            self.send_header("Content-Disposition",
                             "attachment; filename*=UTF-8''" + urllib.parse.quote(adi))
        else:
            self.send_header("Content-Disposition",
                             "inline; filename*=UTF-8''" + urllib.parse.quote(adi))
        self.send_header("Content-Length", str(len(govde)))
        self.end_headers()
        self.wfile.write(govde)

    # --- POST uçları -------------------------------------------------------
    def api_post(self, uc):
        try:
            veri = self.govde_oku()
        except Exception:
            return self.hata("Gönderilen bilgi okunamadı.", 400)

        if uc == "kayit":
            return self.kayit(veri)
        if uc == "giris":
            return self.giris(veri)
        if uc == "cikis":
            jeton = self.cerezler().get("oturum")
            oturumlar.pop(jeton, None)
            return self.json_gonder({"tamam": True},
                                    cerez="oturum=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly")
        if uc == "not":
            return self.not_ekle(veri)
        if uc == "begeni":
            return self.begeni(veri)
        if uc == "kaydet":
            return self.kaydet(veri)
        if uc == "bolum":
            return self.bolum_degistir(veri)
        if uc == "yil":
            return self.yil_degistir(veri)
        if uc == "sifre":
            return self.sifre_degistir(veri)
        if uc == "sifirla":
            return self.sifirla(veri)
        return self.hata("Bulunamadı", 404)

    def begeni(self, veri):
        """Bir notu beğen ya da beğeniyi geri al."""
        k = self.kullanici()
        if not k:
            return self.hata("Beğenmek için giriş yapmalısın.", 401)
        not_id = veri.get("id") or ""
        with kilit:
            n = next((x for x in notlar if x["id"] == not_id), None)
            if not n:
                return self.hata("Not bulunamadı.", 404)
            begenenler = n.setdefault("begenenler", [])
            if k["id"] in begenenler:
                begenenler.remove(k["id"])
            else:
                begenenler.append(k["id"])
            yaz(NOTLAR, notlar)
            return self.json_gonder({"begeni": len(begenenler),
                                     "begendim": k["id"] in begenenler})

    def kaydet(self, veri):
        """Notu kendi kaydettiklerine ekle ya da çıkar."""
        k = self.kullanici()
        if not k:
            return self.hata("Kaydetmek için giriş yapmalısın.", 401)
        not_id = veri.get("id") or ""
        with kilit:
            n = next((x for x in notlar if x["id"] == not_id), None)
            if not n:
                return self.hata("Not bulunamadı.", 404)
            liste = k.setdefault("kaydedilenler", [])
            if not_id in liste:
                liste.remove(not_id)
            else:
                liste.insert(0, not_id)
            yaz(KISILER, kisiler)
            return self.json_gonder({"kaydettim": not_id in liste,
                                     "kayitSayisi": len(liste)})

    def sifre_degistir(self, veri):
        k = self.kullanici()
        if not k:
            return self.hata("Şifreni değiştirmek için giriş yapmalısın.", 401)
        eski = veri.get("eski") or ""
        yeni = veri.get("yeni") or ""
        if sifre_ozeti(eski, k["tuz"]) != k["sifre"]:
            return self.hata("Mevcut şifren doğru görünmüyor.")
        if len(yeni) < 6:
            return self.hata("Yeni şifre en az 6 karakter olsun.")
        with kilit:
            k["tuz"] = secrets.token_hex(16)
            k["sifre"] = sifre_ozeti(yeni, k["tuz"])
            yaz(KISILER, kisiler)
        return self.json_gonder({"tamam": True})

    def sifirla(self, veri):
        """Şifresini unutan kullanıcı: e-posta + kayıtlı ad eşleşirse yeni şifre belirler."""
        eposta = (veri.get("eposta") or "").strip().lower()
        ad = ad_anahtari(veri.get("ad"))
        yeni = veri.get("yeni") or ""
        if not gecerli_eposta(eposta):
            return self.hata("E-posta adresi doğru görünmüyor.")
        if len(ad) < 2:
            return self.hata("Hesabına yazdığın adı yazar mısın?")
        if len(yeni) < 6:
            return self.hata("Yeni şifre en az 6 karakter olsun.")
        with kilit:
            k = next((x for x in kisiler if x["eposta"] == eposta), None)
            if not k:
                return self.hata("Bu e-postayla kayıtlı hesap yok. 'Kayıt ol' ile hesap açabilirsin.", 404)
            kayitli = ad_anahtari(k.get("ad"))
            parcalar = [p for p in ad.split(" ") if len(p) > 1]
            if not parcalar or not all(p in kayitli.split(" ") for p in parcalar):
                return self.hata("Yazdığın ad bu e-postadaki hesapla eşleşmiyor. "
                                 "Kayıt olurken yazdığın adı dene.", 403)
            k["tuz"] = secrets.token_hex(16)
            k["sifre"] = sifre_ozeti(yeni, k["tuz"])
            yaz(KISILER, kisiler)
            jeton = secrets.token_urlsafe(32)
            oturumlar[jeton] = k["id"]
        return self.json_gonder({"kullanici": kullanici_ozeti(k)},
                                cerez=f"oturum={jeton}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")

    def bolum_degistir(self, veri):
        k = self.kullanici()
        if not k:
            return self.hata("Giriş yapmalısın.", 401)
        bolum = (veri.get("bolum") or "").strip()
        bolumler = {b["kod"] for b in katalog.get("bolumler", [])}
        if bolum not in bolumler:
            return self.hata("Bölümünü listeden seçer misin?")
        with kilit:
            k["bolum"] = bolum
            yaz(KISILER, kisiler)
        return self.json_gonder({"kullanici": kullanici_ozeti(k)})

    def yil_degistir(self, veri):
        k = self.kullanici()
        if not k:
            return self.hata("Giriş yapmalısın.", 401)
        try:
            yil = int(veri.get("girisYili"))
        except (TypeError, ValueError):
            return self.hata("Giriş yılını listeden seçer misin?")
        if not (2000 <= yil <= time.localtime().tm_year + 1):
            return self.hata("Giriş yılını listeden seçer misin?")
        with kilit:
            k["girisYili"] = yil
            yaz(KISILER, kisiler)
        return self.json_gonder({"kullanici": kullanici_ozeti(k)})

    def api_delete(self, uc):
        if not uc.startswith("not/"):
            return self.hata("Bulunamadı", 404)
        k = self.kullanici()
        if not k:
            return self.hata("Giriş yapmalısın.", 401)
        not_id = uc[4:]
        with kilit:
            n = next((x for x in notlar if x["id"] == not_id), None)
            if not n:
                return self.hata("Not bulunamadı.", 404)
            if n["yukleyenId"] != k["id"]:
                return self.hata("Bu notu sadece yükleyen silebilir.", 403)
            notlar.remove(n)
            yaz(NOTLAR, notlar)
            # silinen not, kaydedenlerin listesinde kalmasın
            degisti = False
            for x in kisiler:
                liste = x.get("kaydedilenler") or []
                if not_id in liste:
                    liste.remove(not_id)
                    degisti = True
            if degisti:
                yaz(KISILER, kisiler)
            try:
                os.remove(os.path.join(DOSYALAR, n["dosya"]))
            except OSError:
                pass
        return self.json_gonder({"tamam": True})

    def kayit(self, veri):
        ad = (veri.get("ad") or "").strip()
        eposta = (veri.get("eposta") or "").strip().lower()
        sifre = veri.get("sifre") or ""
        bolum = (veri.get("bolum") or "").strip()
        giris_yili = veri.get("girisYili")
        if len(ad) < 2:
            return self.hata("Adını yazar mısın?")
        if not gecerli_eposta(eposta):
            return self.hata("E-posta adresi doğru görünmüyor.")
        if not boun_epostasi(eposta):
            return self.hata("bunot'a sadece Boğaziçi e-postasıyla kayıt olunabilir (@boun.edu.tr).")
        if len(sifre) < 6:
            return self.hata("Şifre en az 6 karakter olsun.")
        bolumler = {b["kod"] for b in katalog.get("bolumler", [])}
        if bolum not in bolumler:
            return self.hata("Bölümünü listeden seçer misin?")
        if giris_yili in (None, ""):
            giris_yili = ""
        else:
            try:
                giris_yili = int(giris_yili)
            except (TypeError, ValueError):
                return self.hata("Giriş yılını listeden seçer misin?")
            if not (2000 <= giris_yili <= time.localtime().tm_year + 1):
                return self.hata("Giriş yılını listeden seçer misin?")
        with kilit:
            if any(k["eposta"] == eposta for k in kisiler):
                return self.hata("Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.")
            tuz = secrets.token_hex(16)
            k = {
                "id": secrets.token_hex(8),
                "ad": ad,
                "eposta": eposta,
                "bolum": bolum,
                "girisYili": giris_yili,
                "tuz": tuz,
                "sifre": sifre_ozeti(sifre, tuz),
                "tarih": time.strftime("%Y-%m-%d %H:%M"),
                "kaydedilenler": [],
            }
            kisiler.append(k)
            yaz(KISILER, kisiler)
            jeton = secrets.token_urlsafe(32)
            oturumlar[jeton] = k["id"]
        return self.json_gonder({"kullanici": kullanici_ozeti(k)},
                                cerez=f"oturum={jeton}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")

    def giris(self, veri):
        eposta = (veri.get("eposta") or "").strip().lower()
        sifre = veri.get("sifre") or ""
        with kilit:
            k = next((x for x in kisiler if x["eposta"] == eposta), None)
            if not k:
                return self.hata("Bu e-postayla kayıtlı hesap yok. 'Kayıt ol' ile hesap açabilirsin.", 404)
            if sifre_ozeti(sifre, k["tuz"]) != k["sifre"]:
                return self.hata("Şifre hatalı. Küçük/büyük harf ve boşluklara dikkat edip bir daha dene.", 401)
            jeton = secrets.token_urlsafe(32)
            oturumlar[jeton] = k["id"]
        return self.json_gonder({"kullanici": kullanici_ozeti(k)},
                                cerez=f"oturum={jeton}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")

    def not_ekle(self, veri):
        k = self.kullanici()
        if not k:
            return self.hata("Not yüklemek için giriş yapmalısın.", 401)
        ders_kodu = (veri.get("dersKodu") or "").strip()
        baslik = (veri.get("baslik") or "").strip()
        tur = tur_duzelt(veri.get("tur"))
        donem = (veri.get("donem") or katalog.get("donem", "")).strip()
        aciklama = (veri.get("aciklama") or "").strip()[:2000]
        dosya_adi = os.path.basename((veri.get("dosyaAdi") or "").strip())
        dosya_b64 = veri.get("dosya") or ""

        if ders_kodu not in ders_sozluk:
            return self.hata("Ders bulunamadı, listeden seçer misin?")
        if len(baslik) < 3:
            return self.hata("Nota kısa bir başlık ver.")
        if not dosya_adi:
            return self.hata("Bir dosya seçmelisin.")
        try:
            icerik = base64.b64decode(dosya_b64, validate=True)
        except Exception:
            return self.hata("Dosya okunamadı, tekrar dener misin?")
        if not icerik:
            return self.hata("Dosya boş görünüyor.")
        if len(icerik) > AZAMI_DOSYA:
            return self.hata("Dosya 12 MB'tan büyük. Daha küçük bir dosya seç.")

        uzanti = os.path.splitext(dosya_adi)[1].lower()
        izinli = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md",
                  ".jpg", ".jpeg", ".png", ".zip"}
        if uzanti not in izinli:
            return self.hata("Bu dosya türü olmuyor. PDF, Word, PowerPoint, resim veya zip seç.")

        not_id = secrets.token_hex(8)
        dosya = not_id + uzanti
        with open(os.path.join(DOSYALAR, dosya), "wb") as f:
            f.write(icerik)
        n = {
            "id": not_id,
            "dersKodu": ders_kodu,
            "baslik": baslik[:160],
            "tur": tur[:40],
            "donem": donem[:20],
            "aciklama": aciklama,
            "dosya": dosya,
            "dosyaAdi": dosya_adi[:160],
            "boyut": len(icerik),
            "yukleyenId": k["id"],
            "yukleyenAd": k["ad"],
            "tarih": time.strftime("%Y-%m-%d %H:%M"),
            "indirme": 0,
            "begenenler": [],
        }
        with kilit:
            notlar.append(n)
            yaz(NOTLAR, notlar)
        return self.json_gonder({"not": not_ozeti(n)}, 201)


def port_bos(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def main():
    if not port_bos(PORT):
        print(f"Site zaten çalışıyor: http://localhost:{PORT}")
        webbrowser.open(f"http://localhost:{PORT}/")
        return
    sunucu = ThreadingHTTPServer(("127.0.0.1", PORT), Isleyici)
    sunucu.daemon_threads = True
    adres = f"http://localhost:{PORT}/"
    print("=" * 52)
    print("  bunot hazır")
    print(f"  Adres: {adres}")
    print("  Bu pencereyi kapatmak siteyi durdurur.")
    print("=" * 52)
    threading.Timer(0.8, lambda: webbrowser.open(adres)).start()
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        print("\nSite durduruldu.")
    finally:
        sunucu.server_close()


if __name__ == "__main__":
    main()
