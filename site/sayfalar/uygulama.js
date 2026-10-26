/* Boğaziçi Ders Notları — arayüz */
"use strict";

const D = {
  katalog: null,
  mufredat: {},
  kullanici: null,
  notlar: [],
  sayilar: { ders: 0, bolum: 0, not: 0, kisi: 0 },
  seciliBolum: null,
  aramaMetni: "",
  sadeceNotlu: false,
  sadeceLisans: localStorage.getItem("bunot-lisans") !== "0",
};

const $ = (s) => document.querySelector(s);

/* Boğaziçi'nin resmi lisans programları — kayıt listesinde yalnızca bunlar çıkar.
   (Yüksek lisans programları, dil koordinatörlükleri ve servis birimleri hariç.) */
const LISANS_KODLARI = new Set([
  "CHEM", "MATH", "PHYS", "BIO", "HIST", "PHIL", "SOC", "PSY", "POLS", "EC",
  "TR", "TKL", "EL", "CL", "LING",
  "CHE", "CE", "CMPE", "EE", "IE", "ME",
  "AD", "MIS", "INTT",
  "CET", "ED", "FLED", "SCED", "PRED",
  "TRM",
]);

function lisansGruplari() {
  return bolumGruplari(true)
    .filter((g) => g.kodlar.some((k) => LISANS_KODLARI.has(k)));
}

/* ------------------------------------------------------------------ tema */
function temaDurum() {
  return document.documentElement.getAttribute("data-tema") === "koyu" ? "koyu" : "acik";
}

function temaEtiketle() {
  const koyu = temaDurum() === "koyu";
  const d = $("#tema-dugme");
  if (!d) return;
  const metin = koyu ? "Açık moda geç" : "Koyu moda geç";
  d.title = metin;
  d.setAttribute("aria-label", metin);
  d.setAttribute("aria-pressed", koyu ? "true" : "false");
}

function temaDegistir() {
  const yeni = temaDurum() === "koyu" ? "acik" : "koyu";
  document.documentElement.setAttribute("data-tema", yeni);
  try { localStorage.setItem("bunot-tema", yeni); } catch (e) { /* gizli sekme */ }
  temaEtiketle();
}

/* ------------------------------------------------------------------ yardım */
function kac(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function kucult(s) {
  return String(s ?? "").toLocaleLowerCase("tr");
}

const KUCUK_KELIME = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "for",
  "to", "with", "at", "by", "from", "as", "into", "over", "per", "via", "ve", "ile"]);
const KISALTMA = new Set(["I", "II", "III", "IV", "V", "VI", "VII", "AI", "EU", "USA",
  "UK", "IT", "HR", "MBA", "PHD", "TV", "3D", "DNA", "RNA", "STEM"]);

/* TAMAMI BÜYÜK HARF gelen resmi adları okunur hâle getirir: "ASIAN STUDIES" → "Asian Studies"
   İngilizce adlarda "I" harfi noktasız "ı"ya dönüşmesin diye sözcük, Türkçe harf
   içermiyorsa dilden bağımsız küçültülür. */
const TURKCE_HARF = /[ÇĞİÖŞÜ]/;

function kelimeKucult(k) {
  return TURKCE_HARF.test(k) ? k.toLocaleLowerCase("tr") : k.toLowerCase();
}

function kelime(k, ilk) {
  if (!k) return k;
  if (KISALTMA.has(k.toUpperCase())) return k.toUpperCase();
  if (k.includes("-")) return k.split("-").map((p, i) => kelime(p, ilk && i === 0)).join("-");
  if (k === "&" || k === "/") return k;
  const kucuk = kelimeKucult(k);
  if (!ilk && KUCUK_KELIME.has(kucuk)) return kucuk;
  return kucuk.charAt(0).toUpperCase() + kucuk.slice(1);
}

function baslik(metin) {
  const duzenli = String(metin ?? "").replace(/\s*&\s*/g, " & ");
  return duzenli.split(/\s+/).map((k, i) => kelime(k, i === 0)).join(" ");
}

/* bölüm kodlarına sabit ama dağınık pastel renk */
function renkSinifi(kod) {
  let h = 0;
  for (const harf of String(kod)) h = (h * 31 + harf.charCodeAt(0)) % 9973;
  return "r" + (h % 6);
}

function tarihYaz(metin) {
  if (!metin) return "";
  const [tarih] = metin.split(" ");
  const [y, a, g] = tarih.split("-");
  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  return `${Number(g)} ${aylar[Number(a) - 1] || ""} ${y}`;
}

function donemYaz(d) {
  const m = String(d || "").match(/^(\d{4})\/(\d{4})-([12])$/);
  if (!m) return d || "";
  return `${m[1]}/${m[2]} ${m[3] === "1" ? "Güz" : "Bahar"}`;
}

function boyutYaz(b) {
  if (!b) return "";
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}

/* ---------------------------------------------------------- form denetimi */
/* Tarayıcının "lütfen bu alanı doldurun" balonu yerine sitenin kendi uyarısı */
const ALAN_MESAJI = {
  "giris-ad": "Adını yazmayı unuttun.",
  "giris-bolum": "Bölümünü seçer misin? Derslerini ona göre göstereceğiz.",
  "giris-yil": "Giriş yılını seçer misin? Müfredat yıla göre değişiyor.",
  "giris-eposta": "Boğaziçi e-postanı yazmayı unuttun.",
  "giris-kayitli-ad": "Hesabına yazdığın adı yazmayı unuttun.",
  "giris-sifre": "Şifreni yazmayı unuttun.",
  "giris-yeni-sifre": "Yeni şifreni yazmayı unuttun.",
  "s-eski": "Mevcut şifreni yazmayı unuttun.",
  "s-yeni": "Yeni şifreni yazmayı unuttun.",
  "s-tekrar": "Yeni şifreyi bir kez daha yaz.",
  "y-ders": "Hangi ders için yüklüyorsun? Ders kodunu yaz (ör. SOC 101).",
  "y-baslik": "Nota bir başlık ver.",
  "y-dosya": "Yükleyeceğin dosyayı seçmeyi unuttun.",
};

function ilkEksik(form) {
  for (const a of form.querySelectorAll("input, select, textarea")) {
    if (a.type === "hidden" || a.disabled || a.closest(".gizli")) continue;
    const bos = a.type === "file" ? !a.files.length : !String(a.value).trim();
    if (bos) return { alan: a, metin: ALAN_MESAJI[a.id] || "Bu alanı doldurmayı unuttun." };
    if (a.type === "email" && a.validity && a.validity.typeMismatch) {
      return { alan: a, metin: "E-posta adresi doğru görünmüyor. ör. ad.soyad@boun.edu.tr" };
    }
  }
  return null;
}

function alanUyar(form, uyari) {
  const eksik = ilkEksik(form);
  if (!eksik) return false;
  uyari.textContent = eksik.metin;
  uyari.classList.add("gorunur");
  eksik.alan.classList.add("hatali");
  eksik.alan.focus();
  return true;
}

/* kullanıcı yazmaya başlayınca kırmızı çerçeve kalkar */
document.addEventListener("input", (e) => {
  if (e.target.classList) e.target.classList.remove("hatali");
});
document.addEventListener("change", (e) => {
  if (e.target.classList) e.target.classList.remove("hatali");
});

async function api(yol, secenekler = {}) {
  const { govde, ...geri } = secenekler;
  const secenek = {
    credentials: "same-origin",
    ...geri,
    headers: govde ? { "Content-Type": "application/json", ...(geri.headers || {}) } : (geri.headers || {}),
  };
  if (govde) secenek.body = govde;
  const yanit = await fetch("/api/" + yol, secenek);
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok) throw new Error(veri.hata || "Bir şeyler ters gitti.");
  return veri;
}

function bildir(mesaj) {
  const k = $("#bildirim");
  k.textContent = mesaj;
  k.hidden = false;
  clearTimeout(bildir._z);
  bildir._z = setTimeout(() => { k.hidden = true; }, 3200);
}

/* ------------------------------------------------------------------ tema */
(function temaBaslat() {
  let kayitli = null;
  try { kayitli = localStorage.getItem("bunot-tema"); } catch (e) { /* gizli sekme */ }
  let adresten = null;
  try { adresten = new URLSearchParams(location.search).get("tema"); } catch (e) { /* eski tarayıcı */ }
  const sistemKoyu = window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const secili = (adresten === "koyu" || adresten === "acik") ? adresten
    : (kayitli === "koyu" || kayitli === "acik") ? kayitli
    : (sistemKoyu ? "koyu" : "acik");
  document.documentElement.setAttribute("data-tema", secili);
  temaEtiketle();
})();

function notSayisi(kod) {
  return D.notlar.filter((n) => n.dersKodu === kod).length;
}

/* notu olan dersler listede öne çıkar; kendi aralarında çok notu olan önce */
function notuOlanlarOnce(dersler) {
  const sira = new Map(dersler.map((d, i) => [d.kod, i]));
  return [...dersler].sort((a, b) => {
    const fark = notSayisi(b.kod) - notSayisi(a.kod);
    return fark || sira.get(a.kod) - sira.get(b.kod);
  });
}

/* --- ders süzgeci: yüksek lisans dersleri (500+) istenirse gizlenir --- */
function dersNumarasi(d) {
  const parca = (d.kod.split(" ")[1] || "").replace(/\D/g, "");
  return parseInt(parca, 10) || 0;
}

function gorunenDersler() {
  const hepsi = D.katalog.dersler;
  return D.sadeceLisans ? hepsi.filter((d) => dersNumarasi(d) < 500) : hepsi;
}

function bolumSayilari() {
  const sayi = {};
  for (const d of gorunenDersler()) sayi[d.bolum] = (sayi[d.bolum] || 0) + 1;
  return sayi;
}

/* --- arama: "tr109", "TR 109", "tr-109" hepsi aynı dersi bulur --- */
function aramaAnahtari(metin) {
  return kucult(metin)
    .replace(/ı/g, "i")
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u")
    .replace(/[\s.,;:/\\_\-–—]/g, "");
}

function dersAra(metin) {
  const sik = aramaAnahtari(metin);
  if (!sik) return [];
  const gevsek = kucult(metin).trim();
  return gorunenDersler().filter((d) =>
    d._ara.includes(sik) || kucult(d.ad).includes(gevsek));
}

/* ------------------------------------------------------------------ başlangıç */
async function basla() {
  try {
    const [katalog, oturum, notlar] = await Promise.all([
      api("katalog"),
      api("oturum"),
      api("notlar"),
    ]);
    D.katalog = katalog;
    D.kullanici = oturum.kullanici;
    D.notlar = notlar.notlar || [];
    api("mufredat").then((m) => { D.mufredat = m.mufredat || {}; yonlendir(); }).catch(() => {});
    for (const d of katalog.dersler) d._ara = aramaAnahtari(d.kod + " " + d.ad);
    D.sayilar = {
      ders: katalog.dersler.length,
      bolum: katalog.bolumler.length,
      not: D.notlar.length,
      kisi: 0,
    };
    api("sayilar").then((s) => {
      D.sayilar = s;
      sayacYaz();
      hesapYaz();
    }).catch(() => {});
  } catch (hata) {
    $("#icerik").innerHTML = `<div class="bos-durum"><strong>Site yüklenemedi</strong>${kac(hata.message)}</div>`;
    return;
  }
  yanListeYaz();
  hesapYaz();
  temaEtiketle();
  yukleListesiniDoldur();
  yonlendir();
}

/* ana sayfadaki sayaçlar: sayılar sonradan geldiğinde yerinde güncellenir */
function sayacYaz() {
  const not = document.querySelector('[data-sayac="not"]');
  const kisi = document.querySelector('[data-sayac="kisi"]');
  if (not) not.textContent = D.sayilar.not;
  if (kisi) kisi.textContent = D.sayilar.kisi;
}

/* ------------------------------------------------------------------ üst bar */
function hesapYaz() {
  const k = D.kullanici;
  $("#hesap").innerHTML = k
    ? `<span class="kisi-ad">${kac(k.ad)}</span>
       <button class="dugme kucuk hesap-dugme bolumum-dugme" data-bolumum>Bölümüm</button>
       <button class="dugme kucuk hesap-dugme kaydedilenler-dugme" data-kaydedilenler>Kaydettiklerim${k.kayitSayisi ? ` (${k.kayitSayisi})` : ""}</button>
       <button class="dugme kucuk yukle-dugme" data-yukle><span>Not yükle</span></button>
       <button class="dugme kucuk hesap-dugme cikis-dugme" id="cikis" title="Çıkış yap">Çıkış</button>`
    : `<button class="dugme kucuk giris-dugme" data-giris>Giriş yap</button>`;

}

/* aynı adı taşıyan ya da aynı kodu paylaşan programları tek bölümde toplar
   (CE + ENGG + OHS → Civil Engineering, TRM iki program → Tourism Management) */
function bolumGruplari(hepsi = false) {
  const dersler = hepsi ? D.katalog.dersler : gorunenDersler();
  const sayi = {};
  for (const d of dersler) sayi[d.bolum] = (sayi[d.bolum] || 0) + 1;

  const bolumler = D.katalog.bolumler.filter((b) => sayi[b.kod]);
  const ebeveyn = bolumler.map((_, i) => i);
  const bul = (i) => (ebeveyn[i] === i ? i : (ebeveyn[i] = bul(ebeveyn[i])));
  const birles = (a, b) => {
    const x = bul(a), y = bul(b);
    if (x !== y) ebeveyn[y] = x;
  };
  const adIlk = new Map();
  const kodIlk = new Map();
  bolumler.forEach((b, i) => {
    const ad = baslik(b.ad);
    if (adIlk.has(ad)) birles(adIlk.get(ad), i); else adIlk.set(ad, i);
    if (kodIlk.has(b.kod)) birles(kodIlk.get(b.kod), i); else kodIlk.set(b.kod, i);
  });

  const kova = new Map();
  bolumler.forEach((b, i) => {
    const kok = bul(i);
    if (!kova.has(kok)) kova.set(kok, { kodlar: [], adlar: [], adet: 0 });
    const g = kova.get(kok);
    g.kodlar.push(b.kod);
    g.adlar.push(baslik(b.ad));
    g.adet += sayi[b.kod];
  });

  return [...kova.values()].map((g) => {
    g.adlar.sort((a, b) => a.length - b.length);
    const kodlar = [...new Set(g.kodlar)].sort((a, b) => (sayi[b] || 0) - (sayi[a] || 0));
    return { ad: g.adlar[0], kodlar, kod: kodlar[0], adet: g.adet };
  }).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

function grupBul(kod) {
  return bolumGruplari().find((g) => g.kodlar.includes(kod));
}

function yanListeYaz(suzgec = "") {
  const s = kucult(suzgec);
  const benim = D.kullanici ? D.kullanici.bolum : "";
  const liste = bolumGruplari()
    .filter((g) => !s || kucult(g.ad).includes(s) || g.kodlar.some((k) => kucult(k).includes(s)))
    .sort((a, b) => (b.kodlar.includes(benim) ? 1 : 0) - (a.kodlar.includes(benim) ? 1 : 0));
  $("#bolum-listesi").innerHTML = liste.map((g) => `
    <a class="bolum-satir ${g.kodlar.includes(D.seciliBolum) ? "secili" : ""}"
       href="#/bolum/${g.kod}" title="${kac(g.ad)}">
      <span class="bolum-kod ${renkSinifi(g.kod)}">${kac(g.kod)}</span>
      <span class="bolum-adi"></span>
      <span class="bolum-adet">${g.adet}</span>
    </a>`).join("") || `<div class="bos-durum" style="padding:16px">Eşleşen bölüm yok</div>`;
}

/* kullanıcının bölümünün adı (yoksa kodu) */
function benimBolumAdi() {
  if (!D.kullanici || !D.kullanici.bolum) return "";
  const g = grupBul(D.kullanici.bolum);
  return g ? g.ad : D.kullanici.bolum;
}

/* ------------------------------------------------------------------ yönlendirme */
function yonlendir() {
  const yol = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [tur, ...kalan] = yol.split("/");
  const deger = kalan.join("/");
  if (tur === "bolum" && deger) return bolumGoster(deger);
  if (tur === "bolumum") return bolumumGoster();
  if (tur === "ders" && deger) return dersGoster(deger);
  if (tur === "notlar") return notlarGoster();
  if (tur === "kaydettiklerim") return kaydedilenlerGoster();
  return anaSayfa();
}

/* ------------------------------------------------------------------ ana sayfa */
function anaSayfa() {
  D.seciliBolum = null;
  yanListeYaz($("#bolum-arama").value);
  const son = [...D.notlar].sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 6);
  const bolumler = bolumGruplari();
  const dersSayisi = gorunenDersler().length;
  const hizli = ["SOC 101", "MATH 101", "EC 101", "PSY 101", "CMPE 150", "HIST 105"];
  const mevcut = new Set(D.katalog.dersler.map((d) => d.kod));

  $("#icerik").innerHTML = `
    <div class="kahraman">
      <h1>Ders notu varsa <em>talibiz</em>.</h1>
      <p>Boğaziçi'nin bütün dersleri burada: ${dersSayisi} lisans dersi, tek arama kutusu.
         Ders kodunu yaz, bölümden seç; notu olan dersi kaçırma.</p>
      <div class="hizli">
        <span>Hızlı bak:</span>
        ${hizli.filter((k) => mevcut.has(k)).map((k) =>
          `<a href="#/ders/${encodeURIComponent(k)}">${kac(k)}</a>`).join("")}
      </div>
      ${D.kullanici && D.kullanici.bolum ? `
        <a class="bolum-cip" href="#/bolumum">
          <b>${kac(benimBolumAdi())}</b> bölümün · derslerini sınıf sınıf gör
        </a>` : ""}
      <div class="sayaclar">
        <div class="sayac"><strong>${dersSayisi}</strong><span>ders</span></div>
        <div class="sayac"><strong>${bolumler.length}</strong><span>bölüm</span></div>
        <div class="sayac"><strong data-sayac="not">${D.sayilar.not}</strong><span>paylaşılan not</span></div>
        <div class="sayac"><strong data-sayac="kisi">${D.sayilar.kisi}</strong><span>öğrenci</span></div>
      </div>
    </div>

    ${son.length ? `
      <div class="bolum-basligi-alt">
        <h2>Son eklenen notlar</h2>
        <a href="#/notlar" style="font-size:13px">Tümü →</a>
      </div>
      <div class="not-listesi">${son.map(notKart).join("")}</div>
      <div class="bolum-ayirac">Bölümler</div>
    ` : `<div class="bolum-ayirac">Bölümler</div>`}

    <div class="bolum-izgara">
      ${bolumler.map((g) => `
        <a class="bolum-kart" href="#/bolum/${g.kod}">
          <span class="kod ${renkSinifi(g.kod)}">${kac(g.kod)}</span>
          <span class="ad">${kac(g.ad)}</span>
          <span class="adet">${g.adet} ders</span>
        </a>`).join("")}
    </div>`;
}

/* ------------------------------------------------------------------ bölüm */
function bolumGoster(kod) {
  const g = grupBul(kod);
  if (!g) return anaSayfa();
  D.seciliBolum = g.kod;
  yanListeYaz($("#bolum-arama").value);
  const tumDersler = gorunenDersler().filter((d) => g.kodlar.includes(d.bolum));
  const notluSayi = tumDersler.filter((d) => notSayisi(d.kod)).length;
  const dersler = D.sadeceNotlu
    ? tumDersler.filter((d) => notSayisi(d.kod))
    : notuOlanlarOnce(tumDersler);
  const mufHam = g.kodlar.map((k) => D.mufredat[k]).find(Boolean) || null;
  const girisYili = (D.kullanici && D.kullanici.girisYili) || "";
  const muf = mufredatSurum(mufHam, girisYili);
  const guncel = mufHam ? Number(mufHam.guncelYil) || 0 : 0;
  const yilNotu = mufHam && girisYili && guncel && Number(girisYili) < guncel
    ? `Aşağıda ${guncel} programı var. ${girisYili} girişliler için birkaç ders farklı olabilir; ` +
      `kendi listene görmek için giriş yapıp Bölümüm sayfasına bak.`
    : "";

  $("#icerik").innerHTML = `
    <div class="bolum-basligi">
      <div>
        <h1>${kac(g.ad)}</h1>
        <p>${muf ? "Dönem dönem ders programı" : `${dersler.length} ders`} · ${D.katalog.donem} dönemi</p>
      </div>
      <a class="dugme" href="#/">← Ana sayfa</a>
    </div>
    ${muf ? `
      ${yilNotu ? `<div class="yil-notu">${kac(yilNotu)}</div>` : ""}
      ${mufredatNotlari(muf)}
      ${mufredatBloklari(muf)}` : ""}
    <div class="bolum-basligi-alt">
      <h2>Bu dönem açılan dersler</h2>
      ${notluSayi ? `<button class="filtre-cip${D.sadeceNotlu ? " acik" : ""}" data-notlu>
        ${D.sadeceNotlu ? "Tüm dersleri göster" : `Sadece notu olanlar (${notluSayi})`}
      </button>` : ""}
    </div>
    <div class="ders-izgara">
      ${dersler.map(dersKart).join("")}
    </div>
    ${!dersler.length ? `<div class="bos-durum"><strong>Bu bölümde notu olan ders yok.</strong>
      Filtreyi kapatıp bütün derslere bakabilirsin.</div>` : ""}`;
  window.scrollTo({ top: 0 });
}

/* bölümüm sayfası: ders numarasının ilk rakamı sınıfı verir (TR 109 → 1. sınıf) */
function sinifBilgisi(kod) {
  const parca = (String(kod).split(" ")[1] || "").replace(/\D/g, "");
  if (!parca) return null;
  const ilk = Number(parca[0]);
  if (ilk < 1 || ilk > 4) return null;
  return { sira: ilk, ad: ilk + ". sınıf" };
}

/* müfredattaki bir ders kodunu katalogdan bulur; katalogda yoksa sade kart gösterir */
function mufredatKarti(kod) {
  const d = D.katalog.dersler.find((x) => x.kod === kod);
  if (d) return dersKart(d);
  return `
    <div class="ders-kart bos-kart ${renkSinifi(kod)}">
      <div class="ders-ust">
        <span class="ders-kod">${kac(kod)}</span>
        <span class="etiket">bu dönem açılmıyor</span>
      </div>
      <h3>Ders programında zorunlu</h3>
      <div class="ders-alt">Bahar döneminde açılıyor olabilir</div>
    </div>`;
}

/* müfredat satırı: tek ders, "şunlardan biri" grubu ya da seçmeli */
function satirKarti(s) {
  if (s.tip === "secenek") {
    const icler = s.kodlar.map((k) => {
      const d = D.katalog.dersler.find((x) => x.kod === k);
      const ad = d ? baslik(d.ad) : "bu dönem listede yok";
      return d
        ? `<a class="secenek-satir" href="#/ders/${encodeURIComponent(k)}">
             <span class="secenek-kod">${kac(k)}</span>
             <span class="secenek-ad">${kac(ad)}</span>
           </a>`
        : `<span class="secenek-satir">
             <span class="secenek-kod">${kac(k)}</span>
             <span class="secenek-ad">${kac(ad)}</span>
           </span>`;
    }).join("");
    return `
      <div class="ders-kart secenek-kart ${renkSinifi(s.kodlar[0])}">
        <div class="ders-ust">
          <span class="etiket mavi">birini seç</span>
        </div>
        <h3>${kac(s.ad)}</h3>
        <div class="secenek-liste">${icler}</div>
      </div>`;
  }
  if (s.tip === "secmeli") {
    return `
      <div class="ders-kart secmeli-kart ${renkSinifi(s.ad)}">
        <div class="ders-ust">
          <span class="etiket">seçmeli${s.adet > 1 ? " ×" + s.adet : ""}</span>
        </div>
        <h3>${kac(s.ad)}${s.adet > 1 ? ` (${s.adet} ders)` : ""}</h3>
        <div class="ders-alt">${kac(s.ipucu || "Bölüm onayına tabidir")}</div>
      </div>`;
  }
  return mufredatKarti(s.kod);
}

/* bir dönemin derslerinde kaç not var */
function donemNotSayisi(dn) {
  const kodlar = [];
  for (const s of dn.satirlar) {
    if (s.tip === "secenek") kodlar.push(...(s.kodlar || []));
    else if (s.kod) kodlar.push(s.kod);
  }
  return kodlar.reduce((toplam, kod) => toplam + notSayisi(kod), 0);
}

function donemBlogu(dn, rozet) {
  const not = donemNotSayisi(dn);
  return `
    <div class="sinif-blok">
      <div class="sinif-baslik">
        <strong>${dn.no}. dönem</strong>
        ${rozet ? `<span class="rozet">${kac(rozet)}</span>` : ""}
        <span>${dn.satirlar.length} ders</span>
        ${not ? `<span class="etiket yesil">${not} not</span>` : ""}
      </div>
      <div class="ders-izgara">${dn.satirlar.map(satirKarti).join("")}</div>
    </div>`;
}

/* bölümün dönem dönem müfredatı (varsa) */
function mufredatBloklari(muf) {
  const ilk = muf.donemler.map((dn) => donemBlogu(dn)).join("");
  const yollar = (muf.uzmanlik || []).map((y) => `
    <div class="bolum-ayirac">${kac(y.ad)} uzmanlaşması</div>
    ${y.donemler.map((dn) => donemBlogu(dn)).join("")}`).join("");
  return ilk + yollar;
}

/* müfredatın uyarı notları (varsa) — dönemlerin üstünde gösterilir */
function mufredatNotlari(muf) {
  if (!muf) return "";
  const liste = [...(muf.notlar || [])];
  if (muf.not) liste.unshift(muf.not);
  if (!liste.length) return "";
  return `<ul class="mufredat-notlar">${liste.map((n) => `<li>${kac(n)}</li>`).join("")}</ul>`;
}

function bolumumGoster() {
  if (!D.kullanici) {
    anaSayfa();
    return girisIste("Bölümünü görmek için giriş yapman gerekiyor.");
  }
  const kod = D.kullanici.bolum;
  D.seciliBolum = kod || null;
  yanListeYaz($("#bolum-arama").value);

  if (!kod) {
    $("#icerik").innerHTML = `
      <div class="bolum-basligi">
        <div>
          <h1>Bölümünü seç</h1>
          <p>Derslerini sınıf sınıf gösterebilmemiz için bölümünü seçmen yeterli.</p>
        </div>
      </div>
      <div class="secim-satir">
        <label for="bolumum-secim">Bölümüm</label>
        <select id="bolumum-secim">${bolumSecenekHtml()}</select>
      </div>`;
    bolumumSecimBagla();
    window.scrollTo({ top: 0 });
    return;
  }

  const bg = grupBul(kod);
  const mufHam = (bg ? bg.kodlar : [kod]).map((k) => D.mufredat[k]).find(Boolean) || null;
  const girisYili = D.kullanici.girisYili || "";
  const muf = mufredatSurum(mufHam, girisYili);
  const dersler = gorunenDersler().filter((d) =>
    bg ? bg.kodlar.includes(d.bolum) : d.bolum === kod);
  const gruplar = new Map();
  for (const d of dersler) {
    const s = sinifBilgisi(d.kod);
    if (!s) continue;
    if (!gruplar.has(s.sira)) gruplar.set(s.sira, { ad: s.ad, liste: [] });
    gruplar.get(s.sira).liste.push(d);
  }
  const sirali = [...gruplar.entries()].sort((a, b) => a[0] - b[0]);

  /* müfredatın hangi yıla ait olduğunu söyleyen not */
  const yilNotu = (() => {
    if (!mufHam) return "";
    if (mufHam.surumler && mufHam.surumler.length) {
      const bas = Number(muf.baslangic) || Number(mufHam.guncelYil) || "";
      if (!girisYili || !bas) return "";
      return Number(girisYili) < bas
        ? `Sende ${girisYili} girişliler için geçerli program var.`
        : `${bas} ve sonrası girişliler için geçerli program.`;
    }
    const guncel = Number(mufHam.guncelYil) || 0;
    if (!girisYili || !guncel || Number(girisYili) >= guncel) return "";
    return `Aşağıda ${guncel} programı var. ${girisYili} girişliler için birkaç ders farklı olabilir; ` +
      `kesin liste için bölüm danışmanına sor.`;
  })();

  $("#icerik").innerHTML = `
    <div class="bolum-basligi">
      <div>
        <h1>${kac(benimBolumAdi())}</h1>
        <p>${muf
          ? `Bölümünün ders programı · dönem dönem zorunlu dersler ve seçmeliler`
          : `Senin bölümünün ${dersler.length} dersi · ${D.katalog.donem} dönemi`}</p>
      </div>
      <a class="dugme" href="#/bolum/${encodeURIComponent(bg ? bg.kod : kod)}">Bölüm sayfası →</a>
    </div>
    <div class="secim-satir">
      <label for="bolumum-secim">Bölümüm</label>
      <select id="bolumum-secim">${bolumSecenekHtml(kod)}</select>
      <span style="font-size:12.5px;color:var(--soluk)">Değiştirirsen dersler de ona göre gelir.</span>
    </div>
    <div class="secim-satir">
      <label for="bolumum-yil">Giriş yılın</label>
      <select id="bolumum-yil">${yilSecenekHtml(girisYili)}</select>
      <span style="font-size:12.5px;color:var(--soluk)">Ders programı giriş yılına göre değişebilir.</span>
    </div>
    ${muf ? `
      ${yilNotu ? `<div class="yil-notu">${kac(yilNotu)}</div>` : ""}
      ${mufredatNotlari(muf)}
      ${mufredatBloklari(muf)}` : `
      <div class="bos-durum"><strong>Bu bölümün dönemlik ders programı henüz eklenmedi.</strong>
        Aşağıda bölümün açtığı dersler sınıf sırasına göre listeleniyor; bu resmî program değil.</div>
      ${sirali.map(([, g]) => `
      <div class="sinif-blok">
        <div class="sinif-baslik">
          <strong>${kac(g.ad)}</strong>
          <span>${g.liste.length} ders</span>
        </div>
        <div class="ders-izgara">${g.liste.map(dersKart).join("")}</div>
      </div>`).join("")}`}`;
  bolumumSecimBagla();
  window.scrollTo({ top: 0 });
}

function bolumumSecimBagla() {
  const secim = $("#bolumum-secim");
  if (secim) {
    secim.addEventListener("change", async () => {
      const yeni = secim.value;
      if (!yeni) return;
      secim.disabled = true;
      try {
        const cevap = await api("bolum", { method: "POST", govde: JSON.stringify({ bolum: yeni }) });
        D.kullanici = cevap.kullanici;
        hesapYaz();
        bildir("Bölümün güncellendi.");
        bolumumGoster();
      } catch (hata) {
        secim.disabled = false;
        bildir(hata.message);
      }
    });
  }

  const yil = $("#bolumum-yil");
  if (yil) {
    yil.addEventListener("change", async () => {
      if (!yil.value) return;
      yil.disabled = true;
      try {
        const cevap = await api("yil", {
          method: "POST",
          govde: JSON.stringify({ girisYili: Number(yil.value) }),
        });
        D.kullanici = cevap.kullanici;
        hesapYaz();
        bildir("Giriş yılın güncellendi.");
        bolumumGoster();
      } catch (hata) {
        yil.disabled = false;
        bildir(hata.message);
      }
    });
  }
}

function dersKart(d) {
  const n = notSayisi(d.kod);
  return `
    <a class="ders-kart ${renkSinifi(d.bolum)}" href="#/ders/${encodeURIComponent(d.kod)}">
      <div class="ders-ust">
        <span class="ders-kod">${kac(d.kod)}</span>
        ${n ? `<span class="etiket yesil">${n} not</span>` : `<span class="etiket">not yok</span>`}
      </div>
      <h3>${kac(baslik(d.ad))}</h3>
      <div class="ders-alt">
        ${d.hocalar.length ? kac(baslik(d.hocalar.slice(0, 2).join(", "))) : "Hoca bilgisi yok"}
        ${d.kredi ? ` · ${d.kredi} kredi` : ""}${d.ects ? ` · ${d.ects} AKTS` : ""}
      </div>
    </a>`;
}

/* ------------------------------------------------------------------ ders */
function dersGoster(kod) {
  const d = D.katalog.dersler.find((x) => x.kod === kod);
  if (!d) return anaSayfa();
  D.seciliBolum = d.bolum;
  yanListeYaz($("#bolum-arama").value);

  $("#icerik").innerHTML = `
    <a class="geri" href="#/bolum/${d.bolum}">← ${kac(d.bolum)} dersleri</a>
    <div class="ders-baslik-kart">
      <div class="etiket-satir">
        <span class="etiket mavi">${kac(d.kod)}</span>
        ${d.kredi ? `<span class="etiket">${d.kredi} kredi</span>` : ""}
        ${d.ects ? `<span class="etiket">${d.ects} AKTS</span>` : ""}
        ${d.sube ? `<span class="etiket">${d.sube} şube</span>` : ""}
      </div>
      <h1>${kac(baslik(d.ad))}</h1>
      <div class="ders-alt">${d.hocalar.length ? kac(baslik(d.hocalar.join(" · "))) : "Hoca bilgisi yok"}</div>
    </div>
    <div class="bolum-basligi-alt">
      <h2>Notlar</h2>
      <button class="dugme dolu" data-yukle="${kac(d.kod)}">Bu derse not ekle</button>
    </div>
    <div id="ders-notlar"><div class="yukleniyor">Notlar yükleniyor…</div></div>`;

  dersNotlariniYaz(kod);
  window.scrollTo({ top: 0 });
}

async function dersNotlariniYaz(kod) {
  let liste;
  try {
    const cevap = await api("notlar?ders=" + encodeURIComponent(kod));
    liste = cevap.notlar || [];
  } catch {
    $("#ders-notlar").innerHTML = `<div class="bos-durum">Notlar yüklenemedi.</div>`;
    return;
  }
  const kutu = $("#ders-notlar");
  if (!kutu) return;
  kutu.innerHTML = liste.length
    ? `<div class="not-listesi">${liste.map(notKart).join("")}</div>`
    : `<div class="bos-durum">
         <strong>Bu ders için henüz not yok.</strong>
         İlk notu sen ekleyebilirsin — kendi özetin, çalışma kâğıdın, sınav notların.
       </div>`;
}

/* ------------------------------------------------------------------ notlar */
function notKart(n) {
  const uzanti = (n.dosyaAdi.split(".").pop() || "").toUpperCase().slice(0, 4);
  const benim = D.kullanici && D.kullanici.id === n.yukleyenId;
  const begeni = n.begeni || 0;
  return `
    <article class="not-kart" data-not="${n.id}">
      <div class="dosya-simge">${kac(uzanti)}</div>
      <div>
        <div class="not-baslik">${kac(n.baslik)}</div>
        <div class="not-alt">
          <a href="#/ders/${encodeURIComponent(n.dersKodu)}" class="etiket mavi">${kac(n.dersKodu)}</a>
          <span>${kac(n.tur)}</span>
          ${n.donem ? `<span>${kac(donemYaz(n.donem))}</span>` : ""}
          <span>${kac(n.yukleyen)}</span>
          <span>${tarihYaz(n.tarih)}</span>
          <span>${n.indirme || 0} indirme</span>
          <span data-begeni-alt${begeni ? "" : " hidden"}>${begeni} beğeni</span>
          <span>${boyutYaz(n.boyut)}</span>
        </div>
        ${n.aciklama ? `<div class="not-aciklama">${kac(n.aciklama)}</div>` : ""}
      </div>
      <div class="not-eylem">
        ${benim ? `<button class="dugme sade kucuk" data-sil="${n.id}">Sil</button>` : ""}
        <button class="dugme sade kucuk begeni-dugme${n.begendim ? " secili" : ""}"
                data-begeni="${n.id}" aria-pressed="${n.begendim ? "true" : "false"}"
                title="Bu not işime yaradı">♥ <span data-begeni-sayi>${begeni}</span></button>
        <button class="dugme sade kucuk kaydet-dugme${n.kaydettim ? " secili" : ""}"
                data-kaydet="${n.id}" aria-pressed="${n.kaydettim ? "true" : "false"}"
                title="Sonra bakmak için kaydet">${n.kaydettim ? "Kaydedildi" : "Kaydet"}</button>
        <button class="dugme kucuk" data-bak="${n.id}">Bak</button>
        <button class="dugme kucuk" data-indir="${n.id}">İndir</button>
      </div>
    </article>`;
}

function notlarGoster() {
  D.seciliBolum = null;
  yanListeYaz($("#bolum-arama").value);
  const liste = [...D.notlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
  $("#icerik").innerHTML = `
    <div class="bolum-basligi">
      <div>
        <h1>Tüm notlar</h1>
        <p>${liste.length} not paylaşılmış</p>
      </div>
      <button class="dugme dolu" data-yukle>Not yükle</button>
    </div>
    ${liste.length
      ? `<div class="not-listesi">${liste.map(notKart).join("")}</div>`
      : `<div class="bos-durum"><strong>Henüz not yok.</strong>İlk notu sen ekleyebilirsin.</div>`}`;
  window.scrollTo({ top: 0 });
}

function kaydedilenlerGoster() {
  D.seciliBolum = null;
  yanListeYaz($("#bolum-arama").value);
  if (!D.kullanici) {
    anaSayfa();
    return girisIste("Kaydettiklerini görmek için giriş yapman gerekiyor.");
  }
  const liste = D.notlar.filter((n) => n.kaydettim);
  $("#icerik").innerHTML = `
    <div class="bolum-basligi">
      <div>
        <h1>Kaydettiklerim</h1>
        <p>${liste.length} not · sonra bakmak için ayırdıkların</p>
      </div>
      <a class="dugme" href="#/notlar">Tüm notlar →</a>
    </div>
    ${liste.length
      ? `<div class="not-listesi">${liste.map(notKart).join("")}</div>`
      : `<div class="bos-durum"><strong>Henüz not kaydetmedin.</strong>
           Bir notun yanındaki "Kaydet" düğmesine bas; burada birikir.</div>`}`;
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ arama */
function aramaYap(metin) {
  D.aramaMetni = metin;
  const s = kucult(metin).trim();
  if (s.length < 2) { yonlendir(); return; }

  const dersler = notuOlanlarOnce(dersAra(metin)).slice(0, 60);
  const notlar = D.notlar.filter((n) =>
    kucult(n.baslik).includes(s) || kucult(n.aciklama).includes(s) ||
    aramaAnahtari(n.dersKodu).includes(aramaAnahtari(metin))).slice(0, 30);

  $("#icerik").innerHTML = `
    <div class="bolum-basligi">
      <div>
        <h1>“${kac(metin)}” için sonuçlar</h1>
        <p>${dersler.length} ders · ${notlar.length} not</p>
      </div>
    </div>
    ${dersler.length ? `<div class="bolum-ayirac">Dersler</div>
      <div class="ders-izgara">${dersler.map(dersKart).join("")}</div>` : ""}
    ${notlar.length ? `<div class="bolum-ayirac">Notlar</div>
      <div class="not-listesi">${notlar.map(notKart).join("")}</div>` : ""}
    ${!dersler.length && !notlar.length
      ? `<div class="bos-durum"><strong>Sonuç bulunamadı.</strong>Ders kodunu tam yazmayı dene: SOC 101 gibi.</div>` : ""}`;
}

/* ------------------------------------------------------------------ giriş */
let girisModu = "giris";

function bolumSecenekHtml(secili = "") {
  return `<option value="">Bölüm seç…</option>` +
    lisansGruplari()
      .map((g) => `<option value="${kac(g.kod)}"${g.kodlar.includes(secili) ? " selected" : ""}>` +
        `${kac(g.ad)}</option>`)
      .join("");
}

function bolumSecenekleri() {
  const kutu = $("#giris-bolum");
  if (!kutu || kutu.dataset.dolu === "1") return;
  kutu.innerHTML = bolumSecenekHtml();
  kutu.dataset.dolu = "1";
}

/* giriş yılı: müfredat yıla göre değişebildiği için soruluyor */
function yilSecenekHtml(secili = "") {
  const son = new Date().getFullYear() + 1;
  let html = `<option value="">Yıl seç…</option>`;
  for (let y = son; y >= 2000; y--) {
    html += `<option value="${y}"${String(secili) === String(y) ? " selected" : ""}>${y}</option>`;
  }
  return html;
}

function yilSecenekleri() {
  const kutu = $("#giris-yil");
  if (!kutu || kutu.dataset.dolu === "1") return;
  kutu.innerHTML = yilSecenekHtml();
  kutu.dataset.dolu = "1";
}

/* bölümün müfredatından giriş yılına uyan sürümü seçer */
function mufredatSurum(muf, yil) {
  if (!muf) return null;
  const surumler = muf.surumler || [];
  if (!surumler.length) return muf;
  const y = Number(yil) || 0;
  const sirali = [...surumler].sort((a, b) => Number(b.baslangic) - Number(a.baslangic));
  if (!y) return sirali[0];
  return sirali.find((s) => Number(s.baslangic) <= y) || sirali[sirali.length - 1];
}

function girisAc(mod = "giris") {
  girisModu = mod;
  const kayit = mod === "kayit";
  const sifirla = mod === "sifirla";
  $("#giris-baslik").textContent = sifirla ? "Şifremi unuttum" : kayit ? "Hesap oluştur" : "Giriş yap";
  $("#giris-gonder").textContent = sifirla ? "Şifremi yenile" : kayit ? "Hesap oluştur" : "Giriş yap";
  $("#giris-soru").textContent = sifirla ? "Şifreni hatırladın mı?" : kayit ? "Hesabın var mı?" : "Hesabın yok mu?";
  $("#giris-degistir").textContent = sifirla ? "Girişe dön" : kayit ? "Giriş yap" : "Kayıt ol";
  $("#sifir-link-satir").hidden = sifirla;
  $("#giris-ipucu").innerHTML = sifirla
    ? "Boğaziçi e-postan ve hesabına yazdığın ad eşleşirse yeni şifreni belirleyebilirsin."
    : "bunot'a sadece Boğaziçi e-postasıyla girilir: <b>@boun.edu.tr</b> veya <b>@std.bogazici.edu.tr</b>";
  $("#ad-alani").classList.toggle("gizli", !kayit);
  $("#bolum-alani").classList.toggle("gizli", !kayit);
  $("#yil-alani").classList.toggle("gizli", !kayit);
  $("#kayitli-ad-alani").classList.toggle("gizli", !sifirla);
  $("#yeni-sifre-alani").classList.toggle("gizli", !sifirla);
  $("#giris-sifre").parentElement.classList.toggle("gizli", sifirla);
  $("#giris-ad").required = kayit;
  $("#giris-kayitli-ad").required = sifirla;
  $("#giris-yeni-sifre").required = sifirla;
  $("#giris-sifre").required = !sifirla;
  if (kayit) {
    bolumSecenekleri();
    yilSecenekleri();
  }
  $("#giris-bolum").required = kayit;
  $("#giris-yil").required = kayit;
  $("#giris-sifre").autocomplete = kayit ? "new-password" : "current-password";
  $("#giris-uyari").classList.remove("gorunur");
  $("#giris-sifre").type = "password";
  $("#giris-yeni-sifre").type = "password";
  document.querySelectorAll('[data-goz="giris-sifre"], [data-goz="giris-yeni-sifre"]')
    .forEach((g) => (g.textContent = "şifreyi göster"));
  $("#perde-giris").hidden = false;
  const odak = sifirla ? $("#giris-eposta") : kayit ? $("#giris-ad") : $("#giris-eposta");
  setTimeout(() => odak.focus(), 60);
}

function girisKapat() { $("#perde-giris").hidden = true; }

function girisIste(mesaj) {
  girisAc("giris");
  const u = $("#giris-uyari");
  u.textContent = mesaj || "Bunun için giriş yapman gerekiyor.";
  u.classList.add("gorunur");
}

$("#giris-degistir").addEventListener("click", (e) => {
  e.preventDefault();
  girisAc(girisModu === "kayit" ? "giris" : girisModu === "sifirla" ? "giris" : "kayit");
});

$("#sifir-link").addEventListener("click", (e) => {
  e.preventDefault();
  girisAc("sifirla");
});

$("#giris-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dugme = $("#giris-gonder");
  const uyari = $("#giris-uyari");
  uyari.classList.remove("gorunur");
  if (alanUyar($("#giris-form"), uyari)) return;
  const govde = {
    eposta: $("#giris-eposta").value.trim(),
    sifre: $("#giris-sifre").value,
  };
  if (girisModu === "sifirla") {
    govde.ad = $("#giris-kayitli-ad").value.trim();
    govde.yeni = $("#giris-yeni-sifre").value;
    if (govde.ad.length < 2) {
      uyari.textContent = "Hesabına yazdığın adı yazar mısın?";
      uyari.classList.add("gorunur");
      return;
    }
    if (govde.yeni.length < 6) {
      uyari.textContent = "Yeni şifre en az 6 karakter olsun.";
      uyari.classList.add("gorunur");
      return;
    }
  }
  if (girisModu === "kayit") {
    govde.ad = $("#giris-ad").value.trim();
    govde.bolum = $("#giris-bolum").value;
    govde.girisYili = $("#giris-yil").value;
    if (!govde.bolum) {
      uyari.textContent = "Bölümünü seçer misin? Derslerini ona göre önereceğiz.";
      uyari.classList.add("gorunur");
      return;
    }
    if (!govde.girisYili) {
      uyari.textContent = "Giriş yılını seçer misin? Müfredat yıla göre değişebiliyor.";
      uyari.classList.add("gorunur");
      return;
    }
  }

  dugme.disabled = true;
  dugme.textContent = "Bir saniye…";
  try {
    const uc = girisModu === "kayit" ? "kayit" : girisModu === "sifirla" ? "sifirla" : "giris";
    const cevap = await api(uc, {
      method: "POST",
      govde: JSON.stringify(govde),
    });
    D.kullanici = cevap.kullanici;
    girisKapat();
    hesapYaz();
    if (girisModu === "sifirla") {
      bildir("Şifren yenilendi, artık giriş yaptın.");
      $("#giris-form").reset();
      yonlendir();
      return;
    }
    bildir(`Hoş geldin ${cevap.kullanici.ad.split(" ")[0]}!`);
    if (girisModu === "kayit" && cevap.kullanici.bolum) {
      location.hash = "#/bolum/" + encodeURIComponent(cevap.kullanici.bolum);
      yonlendir();
    } else {
      yonlendir();
    }
    api("sayilar").then((s) => { D.sayilar = s; }).catch(() => {});
  } catch (hata) {
    uyari.textContent = hata.message;
    uyari.classList.add("gorunur");
  } finally {
    dugme.disabled = false;
    dugme.textContent = girisModu === "sifirla" ? "Şifremi yenile"
      : girisModu === "kayit" ? "Hesap oluştur" : "Giriş yap";
  }
});

/* şifre değiştirme */
$("#sifre-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const uyari = $("#sifre-uyari");
  const dugme = $("#sifre-gonder");
  uyari.classList.remove("gorunur");
  if (alanUyar($("#sifre-form"), uyari)) return;
  const eski = $("#s-eski").value;
  const yeni = $("#s-yeni").value;
  const tekrar = $("#s-tekrar").value;
  const uyar = (metin) => {
    uyari.textContent = metin;
    uyari.classList.add("gorunur");
  };
  uyari.classList.remove("gorunur");
  if (yeni !== tekrar) return uyar("İki yeni şifre birbirini tutmuyor.");
  if (yeni.length < 6) return uyar("Yeni şifre en az 6 karakter olsun.");
  dugme.disabled = true;
  dugme.textContent = "Kaydediliyor…";
  try {
    await api("sifre", { method: "POST", govde: JSON.stringify({ eski, yeni }) });
    $("#perde-sifre").hidden = true;
    $("#sifre-form").reset();
    bildir("Şifren güncellendi.");
  } catch (hata) {
    uyar(hata.message);
  } finally {
    dugme.disabled = false;
    dugme.textContent = "Şifremi değiştir";
  }
});

/* ------------------------------------------------------------------ yükleme */
/* dönem: serbest yazı yerine listeden seçilir, böylece herkes aynı biçimi kullanır */
function donemSecenekHtml(secili = "") {
  const simdiki = D.katalog.donem || "2026/2027-1";
  const [ilkYil, yari] = simdiki.split("/");
  let yil = Number(ilkYil) || new Date().getFullYear();
  let donem = Number(yari) || 1;
  const liste = [];
  for (let i = 0; i < 8; i++) {
    liste.push(`${yil}/${yil + 1}-${donem}`);
    if (donem === 1) donem = 2;
    else { donem = 1; yil -= 1; }
  }
  return liste.map((d) => {
    const [a, kalan] = d.split("/");
    const [b, yari2] = kalan.split("-");
    const etiket = `${a}/${b} ${yari2 === "1" ? "Güz" : "Bahar"}`;
    return `<option value="${d}"${d === secili ? " selected" : ""}>${etiket}</option>`;
  }).join("");
}

function yukleListesiniDoldur() {
  $("#ders-listesi").innerHTML = D.katalog.dersler
    .map((d) => `<option value="${kac(d.kod)}">${kac(d.ad)}</option>`).join("");
  const donem = $("#y-donem");
  if (donem && donem.dataset.dolu !== "1") {
    donem.innerHTML = donemSecenekHtml(D.katalog.donem || "");
    donem.dataset.dolu = "1";
  }
}

function yukleAc(dersKodu) {
  if (!D.kullanici) return girisIste("Not yüklemek için önce giriş yapman gerekiyor.");
  $("#perde-yukle").hidden = false;
  $("#y-ders").value = dersKodu || "";
  if (!dersKodu) $("#y-ders").value = "";
  $("#y-donem").value = D.katalog.donem || "";
  $("#yukle-uyari").classList.remove("gorunur");
  setTimeout(() => $("#y-ders").focus(), 60);
}

$("#yukle-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const uyari = $("#yukle-uyari");
  const dugme = $("#yukle-gonder");
  uyari.classList.remove("gorunur");
  if (alanUyar($("#yukle-form"), uyari)) return;
  const dosya = $("#y-dosya").files[0];
  const dersKodu = $("#y-ders").value.trim().replace(/\s+/g, " ").toUpperCase();

  if (!dosya) {
    uyari.textContent = "Bir dosya seçmelisin.";
    uyari.classList.add("gorunur");
    return;
  }
  if (dosya.size > 12 * 1024 * 1024) {
    uyari.textContent = "Dosya 12 MB'tan büyük. Daha küçük bir dosya seç.";
    uyari.classList.add("gorunur");
    return;
  }

  dugme.disabled = true;
  dugme.textContent = "Yükleniyor…";
  try {
    const icerik = await new Promise((ok, hata) => {
      const okuyucu = new FileReader();
      okuyucu.onload = () => ok(String(okuyucu.result).split(",")[1] || "");
      okuyucu.onerror = () => hata(new Error("Dosya okunamadı."));
      okuyucu.readAsDataURL(dosya);
    });

    const cevap = await api("not", {
      method: "POST",
      govde: JSON.stringify({
        dersKodu,
        baslik: $("#y-baslik").value.trim(),
        tur: $("#y-tur").value,
        donem: $("#y-donem").value.trim(),
        aciklama: $("#y-aciklama").value.trim(),
        dosyaAdi: dosya.name,
        dosya: icerik,
      }),
    });

    D.notlar.unshift(cevap.not);
    D.sayilar.not = D.notlar.length;
    $("#perde-yukle").hidden = true;
    e.target.reset();
    bildir("Notun eklendi, teşekkürler!");
    location.hash = "#/ders/" + encodeURIComponent(dersKodu);
    yonlendir();
  } catch (hata) {
    uyari.textContent = hata.message;
    uyari.classList.add("gorunur");
  } finally {
    dugme.disabled = false;
    dugme.textContent = "Notu yükle";
  }
});

/* ------------------------------------------------------------------ indirme */
async function indir(notId) {
  if (!D.kullanici) return girisIste("Not indirmek için giriş yapman gerekiyor.");
  const n = D.notlar.find((x) => x.id === notId);
  try {
    const yanit = await fetch("/api/indir/" + notId, { credentials: "same-origin" });
    if (!yanit.ok) {
      const v = await yanit.json().catch(() => ({}));
      throw new Error(v.hata || "İndirilemedi.");
    }
    const blob = await yanit.blob();
    const adres = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = adres;
    a.download = n ? n.dosyaAdi : "not";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(adres), 4000);
    if (n) n.indirme = (n.indirme || 0) + 1;
    bildir("İndiriliyor…");
  } catch (hata) {
    bildir(hata.message);
  }
}

/* ------------------------------------------------------------------ beğeni */
async function begeniDegistir(notId) {
  if (!D.kullanici) return girisIste("Beğenmek için giriş yapman gerekiyor.");
  const n = D.notlar.find((x) => x.id === notId);
  try {
    const c = await api("begeni", {
      method: "POST",
      govde: JSON.stringify({ id: notId }),
    });
    if (n) { n.begeni = c.begeni; n.begendim = c.begendim; }
    const kart = document.querySelector(`[data-not="${notId}"]`);
    if (kart) {
      const dugme = kart.querySelector("[data-begeni]");
      if (dugme) {
        dugme.classList.toggle("secili", c.begendim);
        dugme.setAttribute("aria-pressed", c.begendim ? "true" : "false");
      }
      const sayi = kart.querySelector("[data-begeni-sayi]");
      if (sayi) sayi.textContent = c.begeni;
      const alt = kart.querySelector("[data-begeni-alt]");
      if (alt) {
        alt.textContent = c.begeni ? c.begeni + " beğeni" : "";
        alt.hidden = !c.begeni;
      }
    }
    bildir(c.begendim ? "Beğendin, teşekkürler." : "Beğeni geri alındı.");
  } catch (hata) {
    bildir(hata.message);
  }
}

/* ------------------------------------------------------------------ kaydetme */
async function kaydetDegistir(notId) {
  if (!D.kullanici) return girisIste("Kaydetmek için giriş yapman gerekiyor.");
  const n = D.notlar.find((x) => x.id === notId);
  try {
    const c = await api("kaydet", {
      method: "POST",
      govde: JSON.stringify({ id: notId }),
    });
    if (n) n.kaydettim = c.kaydettim;
    if (D.kullanici) D.kullanici.kayitSayisi = c.kayitSayisi;
    hesapYaz();
    const kart = document.querySelector(`[data-not="${notId}"]`);
    if (kart) {
      const dugme = kart.querySelector("[data-kaydet]");
      if (dugme) {
        dugme.classList.toggle("secili", c.kaydettim);
        dugme.setAttribute("aria-pressed", c.kaydettim ? "true" : "false");
        dugme.textContent = c.kaydettim ? "Kaydedildi" : "Kaydet";
      }
    }
    bildir(c.kaydettim ? "Kaydedildi. Kaydettiklerim sayfasında bulabilirsin." : "Kayıttan çıkarıldı.");
    if (!c.kaydettim && location.hash.includes("kaydettiklerim")) kaydedilenlerGoster();
  } catch (hata) {
    bildir(hata.message);
  }
}

/* ------------------------------------------------------------------ önizleme */
function notBak(notId) {
  if (!D.kullanici) return girisIste("Nota bakmak için giriş yapman gerekiyor.");
  const n = D.notlar.find((x) => x.id === notId);
  if (!n) return;
  const uzanti = (n.dosyaAdi.split(".").pop() || "").toLowerCase();
  const resim = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(uzanti);
  const adres = "/api/bak/" + encodeURIComponent(notId);

  $("#bak-baslik").textContent = n.baslik;
  $("#bak-alt").textContent = [
    n.dersKodu,
    n.tur,
    n.donem ? donemYaz(n.donem) : "",
    n.yukleyen,
  ].filter(Boolean).join(" · ");

  const govde = $("#bak-govde");
  if (uzanti === "pdf") {
    govde.innerHTML = `<iframe src="${adres}" title="${kac(n.baslik)}"></iframe>`;
  } else if (resim) {
    govde.innerHTML = `<img src="${adres}" alt="${kac(n.baslik)}">`;
  } else {
    govde.innerHTML = `<div class="bos-durum"><strong>Bu dosya tarayıcıda görünmüyor.</strong>
      İndirip açabilirsin.</div>`;
  }
  $("#bak-ders").href = "#/ders/" + encodeURIComponent(n.dersKodu);
  $("#bak-indir").setAttribute("data-indir", notId);
  $("#perde-bak").hidden = false;
}

/* ------------------------------------------------------------------ silme */
async function notSil(notId) {
  if (!confirm("Bu notu silmek istediğine emin misin? Geri alınamaz.")) return;
  try {
    await api("not/" + notId, { method: "DELETE" });
    D.notlar = D.notlar.filter((x) => x.id !== notId);
    D.sayilar.not = D.notlar.length;
    bildir("Not silindi.");
    yonlendir();
  } catch (hata) {
    bildir(hata.message);
  }
}

/* ------------------------------------------------------------------ olaylar */
document.addEventListener("click", (e) => {
  if (e.target.closest("#tema-dugme")) return temaDegistir();

  const g = e.target.closest("[data-giris]");
  if (g) return girisAc("giris");

  const y = e.target.closest("[data-yukle]");
  if (y) return yukleAc(y.getAttribute("data-yukle") || "");

  const i = e.target.closest("[data-indir]");
  if (i) return indir(i.getAttribute("data-indir"));

  const s = e.target.closest("[data-sil]");
  if (s) return notSil(s.getAttribute("data-sil"));

  const bg = e.target.closest("[data-begeni]");
  if (bg) return begeniDegistir(bg.getAttribute("data-begeni"));

  const kd = e.target.closest("[data-kaydet]");
  if (kd) return kaydetDegistir(kd.getAttribute("data-kaydet"));

  const bk = e.target.closest("[data-bak]");
  if (bk) return notBak(bk.getAttribute("data-bak"));

  if (e.target.closest("[data-kaydedilenler]")) {
    location.hash = "#/kaydettiklerim";
    return;
  }

  if (e.target.closest("[data-notlu]")) {
    D.sadeceNotlu = !D.sadeceNotlu;
    if (D.seciliBolum) bolumGoster(D.seciliBolum);
    return;
  }

  if (e.target.closest("[data-bolumum]")) {
    location.hash = "#/bolumum";
    return;
  }

  if (e.target.closest("[data-sifre]")) {    $("#sifre-form").reset();
    $("#sifre-uyari").classList.remove("gorunur");
    $("#perde-sifre").hidden = false;
    setTimeout(() => $("#s-eski").focus(), 60);
    return;
  }

  const k = e.target.closest("[data-kapat]");
  if (k) return document.getElementById(k.getAttribute("data-kapat")).hidden = true;

  const goz = e.target.closest("[data-goz]");
  if (goz) {
    const alan = document.getElementById(goz.getAttribute("data-goz"));
    const acik = alan.type === "text";
    alan.type = acik ? "password" : "text";
    goz.textContent = acik ? "şifreyi göster" : "şifreyi gizle";
    return;
  }

  if (e.target.id === "cikis") {
    api("cikis", { method: "POST" }).finally(() => {
      D.kullanici = null;
      hesapYaz();
      bildir("Çıkış yapıldı.");
      yonlendir();
    });
    return;
  }

  if (e.target.classList.contains("perde")) e.target.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".perde").forEach((p) => (p.hidden = true));
  }
});

let aramaZamani;
$("#arama").addEventListener("input", (e) => {
  clearTimeout(aramaZamani);
  const deger = e.target.value;
  aramaZamani = setTimeout(() => aramaYap(deger), 180);
});

$("#bolum-arama").addEventListener("input", (e) => yanListeYaz(e.target.value));

/* yan panel: fareyle açılır, tıklayınca açık kalır */
(function yanPanel() {
  const yan = $("#yan");
  const tutamac = $("#yan-tutamac");
  if (!yan || !tutamac) return;
  const acikYaz = (acik) => tutamac.setAttribute("aria-expanded", acik ? "true" : "false");
  yan.addEventListener("mouseenter", () => acikYaz(true));
  yan.addEventListener("mouseleave", () => acikYaz(yan.classList.contains("acik")));
  tutamac.addEventListener("click", () => {
    const acik = yan.classList.toggle("acik");
    acikYaz(acik);
    if (acik) setTimeout(() => $("#bolum-arama").focus(), 380);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && yan.classList.contains("acik")) {
      yan.classList.remove("acik");
      acikYaz(false);
    }
  });
})();

const lisansKutu = $("#lisans-filtre");
lisansKutu.checked = D.sadeceLisans;
lisansKutu.addEventListener("change", (e) => {
  D.sadeceLisans = e.target.checked;
  localStorage.setItem("bunot-lisans", D.sadeceLisans ? "1" : "0");
  yanListeYaz($("#bolum-arama").value);
  if ($("#arama").value.trim().length >= 2) aramaYap($("#arama").value);
  else yonlendir();
});

window.addEventListener("hashchange", () => {
  if ($("#arama").value) $("#arama").value = "";
  yonlendir();
});

basla();

