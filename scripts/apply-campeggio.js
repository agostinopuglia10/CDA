// Collega la categoria "Campeggio" al sito: albero categorie (CATEGORIES_DATA in js/main.js, da cui il build genera
// le pagine categoria-campeggio*.html), voce nel menu a tendina "Shop Camper" e card in home e in shop.
// Idempotente. NON eseguire prima del lancio: appena c'e' la voce in CATEGORIES_DATA il build genera pagine pubbliche.
// Ordine al lancio (vedi supabase/drafts/campeggio-lancio.sql, blocco B):
//   1) eseguire il blocco B del file SQL   2) node scripts/apply-campeggio.js
//   3) node scripts/build-product-pages.js && node scripts/build-guide-pages.js && node scripts/build-camper-usati.js   4) push
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const generated = /^(prodotto-|categoria-|guida-|camper-usat|guide\.html|catalogo\.html)/;
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !generated.test(f));

const TREE = `  },
  campeggio: {
    name: 'Campeggio',
    description: "Tavoli, sedie, fornelli e accessori da campeggio pieghevoli, da portare in camper per le soste all'aperto.",
    children: {
      'tavoli-sedie': { name: 'Tavoli e sedie', description: 'Tavoli pieghevoli in alluminio e sedie da campeggio, leggeri da trasportare e veloci da montare.' },
      'cucina-campeggio': { name: 'Fornelli e cucina da campeggio', description: "Fornelli e grill a gas portatili per cucinare all'aperto durante le soste." },
      'accessori-campeggio': { name: 'Accessori da campeggio', description: 'Carrelli pieghevoli e piccoli accessori per organizzare le soste in campeggio.' }
    }
  }
};`;

// 1) albero categorie
const mainPath = path.join(ROOT, 'js', 'main.js');
let main = fs.readFileSync(mainPath, 'utf8');
let tree = 0;
if (!/^\s*campeggio:\s*\{/m.test(main)) {
  const anchor = /\r?\n  \}\r?\n\};(\r?\n\r?\n\/\/ Cammina l'albero)/;
  if (!anchor.test(main)) throw new Error("js/main.js: fine di CATEGORIES_DATA non trovata");
  main = main.replace(anchor, (m, tail) => '\n' + TREE + tail);
  fs.writeFileSync(mainPath, main, 'utf8');
  tree = 1;
}

const CARD = (ind) => [
  '<a class="cat-card" href="categoria-campeggio.html">',
  '  <span class="cat-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M3 20L12 4l9 16H3zM12 4v16M9 20l3-6 3 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
  '  <h3>Campeggio</h3><p>Tavoli, sedie e accessori per le soste</p>',
  '</a>'
].map((l) => ind + l).join('\n');

let menu = 0, cards = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;

  // 2) menu a tendina (la prima occorrenza e' il menu in testata, non il footer)
  if (!s.includes('<li><a href="categoria-campeggio.html">Campeggio</a></li>')) {
    s = s.replace(/([ \t]*)(<li><a href="categoria-elettronica\.html">Elettronica &amp; Accessori<\/a><\/li>)/, (m, ind, li) => m + '\n' + ind + '<li><a href="categoria-campeggio.html">Campeggio</a></li>');
    if (s !== before) menu++;
  }

  // 3) card nelle griglie categorie (home e shop)
  if ((f === 'index.html' || f === 'shop.html') && !s.includes('class="cat-card" href="categoria-campeggio.html"')) {
    const re = /([ \t]*)(<a class="cat-card" href="categoria-elettronica\.html">[\s\S]*?<\/a>)/;
    if (!re.test(s)) throw new Error(f + ': card Elettronica non trovata');
    s = s.replace(re, (m, ind) => m + '\n' + CARD(ind));
    cards++;
  }

  if (s !== before) fs.writeFileSync(p, s, 'utf8');
}
console.log('Albero categorie: ' + (tree ? 'aggiunto' : 'gia presente') + '; voce di menu in ' + menu + ' pagine; card in ' + cards + ' pagine.');
