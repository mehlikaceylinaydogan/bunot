/* Yayına hazır statik klasör üretir: docs/
   Site kodu site/sayfalar, veri site/veri içinde durur; ikisi ayrı yerde olduğu için
   tek klasörde topluyoruz. Kişisel veriler (hesaplar, notlar) kopyalanmaz.
   Aynı klasör hem Vercel'e hem GitHub Pages'e yayınlanır. */
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

// GitHub Pages'in Jekyll işleyicisini kapatır (dosyalar olduğu gibi yayınlansın).
fs.writeFileSync(path.join(cikti, ".nojekyll"), "");

console.log("docs/ hazır: sayfalar + dersler.json + mufredat.json");
