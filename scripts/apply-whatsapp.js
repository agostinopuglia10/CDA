// Contatti diretti sul sito: telefono fisso + WhatsApp nel footer di tutte le pagine, link WhatsApp accanto
// ai "Chiamaci" delle schede prodotto/categoria/servizi/contatti. Idempotente: si puo' rilanciare.
// Il pulsante WhatsApp fisso e' in js/main.js (initWhatsappFloat), non qui.
// Numeri: fisso 0774 411120 per le chiamate; 348 990 5455 e' anche su WhatsApp (confermato da Agostino 20/10/2026).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const WA_TEXT = encodeURIComponent('Ciao CDA, vi scrivo dal sito. Vorrei informazioni su:');
const WA_URL = 'https://wa.me/393489905455?text=' + WA_TEXT;

const ADDRESS_LI = '<li><a href="contatti.html">Strada Arci n.24, Tivoli (RM)</a></li>';
const FOOTER_ADD = '\n          <li><a href="tel:+390774411120">Tel. 0774 411120</a></li>'
  + '\n          <li><a href="' + WA_URL + '" rel="noopener">WhatsApp 348 990 5455</a></li>';

let changed = 0;
function edit(file, fn) {
  const p = path.join(ROOT, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) { fs.writeFileSync(p, after, 'utf8'); changed++; }
}

// 1) Footer: tutte le pagine che hanno la riga dell'indirizzo e non hanno ancora il telefono fisso.
fs.readdirSync(ROOT).filter(function (f) { return f.endsWith('.html'); }).forEach(function (f) {
  edit(f, function (h) {
    if (h.indexOf(ADDRESS_LI) === -1 || h.indexOf('Tel. 0774 411120') !== -1) return h;
    return h.split(ADDRESS_LI).join(ADDRESS_LI + FOOTER_ADD);
  });
});

// 2) Schede prodotto (modello), categoria (modello), servizi, contatti: link WhatsApp vicino al telefono.
edit('prodotto.html', function (h) {
  if (h.indexOf('scrivici su WhatsApp') !== -1) return h;
  return h
    .replace('<a href="tel:+393489905455">Chiamaci al 348 990 5455</a> — rispondiamo in giornata.',
      '<a href="tel:+393489905455">Chiamaci al 348 990 5455</a> o <a href="' + WA_URL + '" rel="noopener">scrivici su WhatsApp</a> — rispondiamo in giornata.')
    .replace('<a href="tel:+393489905455">Chiamaci al 348 990 5455</a> o <a href="contatti.html">scrivici</a>.',
      '<a href="tel:+393489905455">Chiamaci al 348 990 5455</a>, <a href="' + WA_URL + '" rel="noopener">scrivici su WhatsApp</a> o <a href="contatti.html">usa il modulo</a>.');
});
edit('categoria.html', function (h) {
  if (h.indexOf('scrivici su WhatsApp') !== -1) return h;
  return h.replace('<a href="tel:+393489905455">Chiamaci</a>, verifichiamo insieme.',
    '<a href="tel:+393489905455">Chiamaci</a> o <a href="' + WA_URL + '" rel="noopener">scrivici su WhatsApp</a>, verifichiamo insieme.');
});
edit('servizi.html', function (h) {
  if (h.indexOf('Scrivici su WhatsApp') !== -1) return h;
  return h.replace('<a href="contatti.html" class="btn btn-primary">Richiedi un intervento</a>',
    '<a href="contatti.html" class="btn btn-primary">Richiedi un intervento</a>\n      <a href="' + WA_URL + '" class="btn btn-outline" rel="noopener">Scrivici su WhatsApp</a>');
});
edit('contatti.html', function (h) {
  if (h.indexOf('>WhatsApp</a>') !== -1) return h;
  return h.replace('<a href="tel:+393489905455" style="color:inherit;">348 990 5455</a>',
    '<a href="tel:+393489905455" style="color:inherit;">348 990 5455</a> · <a href="' + WA_URL + '" style="color:inherit;" rel="noopener">WhatsApp</a>');
});

console.log('apply-whatsapp: file modificati ' + changed);
