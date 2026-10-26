/* Yayına hazır statik klasör üretir: docs/
   Site kodu site/sayfalar, veri site/veri içinde durur; ikisi ayrı yerde olduğu için
   tek klasörde topluyoruz. Kişisel veriler (hesaplar, notlar) kopyalanmaz.
   Aynı klasör hem GitHub Pages'e hem Vercel'e yayınlanır. */
const fs = require("fs");
const path = require("path");

const kok = path.join(__dirname, "..");
const cikti = path.join(kok, "docs");

fs.rmSync(cikti, { recursive: true, force: true });
fs.cpSync(path.join(kok, "site", "sayfalar"), cikti, { recursive: true });

fs.mkdirSync(path.join(cikti, "veri"), { recursive: true });
for (const ad of ["dersler.json", "mufredat.json"]) {
  fs.copyFileSync(
    path.join(kok, "site", "veri", ad),
    path.join(cikti, "veri", ad)
  );
}

/* deneme modu için örnek notlar: dosya adı ve boyutu burada hesaplanır */
const ornekKaynak = path.join(kok, "araclar", "ornek-dosyalar");
const ornekler = JSON.parse(
  fs.readFileSync(path.join(kok, "araclar", "ornek-notlar.json"), "utf8")
);
const ornekCikti = path.join(cikti, "ornek");
fs.cpSync(ornekKaynak, ornekCikti, { recursive: true });

for (const n of ornekler) {
  const ad = String(n.dosya || "").split("/").pop();
  const tam = path.join(ornekKaynak, ad);
  n.dosyaAdi = ad;
  n.boyut = fs.existsSync(tam) ? fs.statSync(tam).size : 0;
}
fs.writeFileSync(
  path.join(cikti, "veri", "ornek-notlar.json"),
  JSON.stringify(ornekler, null, 2),
  "utf8"
);

// GitHub Pages'in Jekyll işleyicisini kapatır (dosyalar olduğu gibi yayınlansın).
fs.writeFileSync(path.join(cikti, ".nojekyll"), "");

console.log(
  "docs/ hazır: sayfalar + dersler.json + mufredat.json + " +
  ornekler.length + " örnek not"
);
