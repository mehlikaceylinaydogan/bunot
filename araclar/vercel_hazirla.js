/* Vercel'deki statik yayın için: sayfaları ve halka açık verileri public/ altında toplar.
   Site kodu site/sayfalar, veri site/veri içinde durur; ikisi ayrı yerde olduğu için
   yayına hazır tek klasör üretiyoruz. Kişisel veriler (hesaplar, notlar) kopyalanmaz. */
const fs = require("fs");
const path = require("path");

const kok = path.join(__dirname, "..");
const cikti = path.join(kok, "public");

fs.rmSync(cikti, { recursive: true, force: true });
fs.cpSync(path.join(kok, "site", "sayfalar"), cikti, { recursive: true });

fs.mkdirSync(path.join(cikti, "veri"), { recursive: true });
for (const ad of ["dersler.json", "mufredat.json"]) {
  fs.copyFileSync(
    path.join(kok, "site", "veri", ad),
    path.join(cikti, "veri", ad)
  );
}

console.log("public/ hazır: sayfalar + dersler.json + mufredat.json");
