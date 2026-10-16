// Collega la sezione "Camper usati" al resto del sito: voce di menu, link nel footer e segnaposto
// del blocco in home. Idempotente. Va eseguito UNA volta quando si decide di pubblicare i camper usati,
// poi: node scripts/build-camper-usati.js (riempie il blocco della home), rigenerare guide e prodotti, push.
//   node scripts/apply-camper-nav.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const generated = /^(prodotto-|categoria-|guida-|camper-usat|guide\.html)/;
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !generated.test(f));
let menu = 0, footer = 0, home = 0;

for (const f of files) {
  const p = path.join(ROOT, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;

  if (!s.includes('href="camper-usati.html">Camper Usati')) {
    s = s.replace(/([ \t]*)(<li(?: class="current")?><a href="chi-siamo\.html">Chi Siamo<\/a><\/li>)/, (m, ind, li) => ind + '<li><a href="camper-usati.html">Camper Usati</a></li>\n' + ind + li);
    if (s !== before) menu++;
  }

  const afterMenu = s;
  if (!s.includes('href="camper-usati.html">Camper usati</a></li>')) {
    s = s.replace(/([ \t]*)(<li><a href="guide\.html">Tutte le guide<\/a><\/li>)/, (m, ind, li) => ind + li + '\n' + ind + '<li><a href="camper-usati.html">Camper usati</a></li>');
    if (s !== afterMenu) footer++;
  }

  if (f === 'index.html' && !s.includes('CAMPER-USATI-HOME:START')) {
    const marker = '<div class="road-line"><div class="rl-label"><span>—</span> DAL PRODOTTO AL CENTRO TECNICO';
    if (!s.includes(marker)) throw new Error('index.html: punto di inserimento del blocco camper non trovato');
    s = s.replace(marker, '<!-- CAMPER-USATI-HOME:START -->\n<!-- CAMPER-USATI-HOME:END -->\n\n' + marker);
    home++;
  }

  if (s !== before) fs.writeFileSync(p, s, 'utf8');
}
console.log('Voce di menu aggiunta in ' + menu + ' pagine, link nel footer in ' + footer + ', blocco home: ' + home + '.');
