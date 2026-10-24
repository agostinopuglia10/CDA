#!/usr/bin/env node
// Genera una pagina statica reale per ogni prodotto attivo del catalogo,
// con title/meta/canonical/og/twitter/JSON-LD già corretti nel file HTML
// pubblicato — non più il template condiviso "prodotto.html" con lo
// stesso identico contenuto placeholder per tutti i 169 prodotti.
//
// Il contenuto visibile (prezzo, descrizione, carrello, prodotti
// correlati) resta gestito com'è sempre stato da js/main.js: ogni
// pagina generata inietta window.CDA_PRODUCT_ID prima che main.js
// carichi, così sa quale prodotto mostrare senza bisogno di leggerlo
// da ?id= nell'URL.
//
// I file finiscono nella root del sito (prodotto-<slug>.html, non in
// una sottocartella) apposta: il template usa link relativi senza "/"
// iniziale per CSS/JS/nav (stile.css, js/main.js, shop.html...) — in
// una sottocartella si sarebbero rotti tutti. Restare nella stessa
// cartella di prodotto.html significa zero percorsi da riscrivere.
//
// Eseguito da Netlify ad ogni deploy (vedi "command" in netlify.toml).

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://udynqqqxjcyhdeygqumi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xjJru5AOW6V242H2L7rZTg_Lg6zXYw5';
const SITE_URL = 'https://cda-camper.it';

const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'prodotto.html');

async function fetchProducts() {
  const url = SUPABASE_URL + '/rest/v1/products?select=id,slug,name,description,price_cents,image_url,brand,is_bundle,featured,in_store_only,category_id,gtin,weight_kg,ships_on_pallet,long_package,shipping_included,categories(name,slug,path)&active=eq.true&order=slug.asc';
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('Fetch prodotti da Supabase fallita: ' + res.status + ' ' + body);
  }
  return res.json();
}

// Fasce di spedizione reali (le stesse del checkout, tabella shipping_rate_bands): servono al costo di
// spedizione nei dati strutturati delle schede prodotto.
async function fetchShippingBands() {
  const url = SUPABASE_URL + '/rest/v1/shipping_rate_bands?select=package_type,weight_min_kg,weight_max_kg,price_cents,zona&order=weight_min_kg.asc';
  const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
  if (!res.ok) throw new Error('Fetch fasce di spedizione fallita: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJsString(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\u003c');
}

let _categoriesDataCache = null;
function loadCategoriesDataCached() {
  if (!_categoriesDataCache) _categoriesDataCache = loadCategoriesData();
  return _categoriesDataCache;
}

// Taglia al limite sul confine di parola (Google tronca titoli oltre ~60 caratteri e descrizioni oltre ~160).
function cutAt(str, max) {
  str = String(str || '').replace(/\s+/g, ' ').trim();
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—(]+$/, '') + '…';
}

// Titolo che entra nei risultati di Google: prova prima il suffisso completo, poi quello corto, poi tronca il nome.
function fitTitle(name) {
  const MAX = 62;
  for (const suffix of [' | Shop CDA Tivoli', ' | CDA Tivoli']) {
    if ((name + suffix).length <= MAX) return name + suffix;
  }
  // Nomi lunghi: meglio il nome intero con il suffisso minimo che un nome troncato. Il troncamento tagliava
  // proprio la parte che distingue prodotti simili (es. "(blister)", "2000W" / "2700W") e produceva titoli uguali.
  if ((name + ' | CDA').length <= MAX + 4) return name + ' | CDA';
  return cutAt(name, MAX - ' | CDA Tivoli'.length) + ' | CDA Tivoli';
}

// Titoli SEO scelti a mano per le ricerche che oggi portano visite (Search Console 15/10/2026): il nome del
// prodotto resta quello del carrello e degli ordini, cambia solo il titolo che Google mostra. Max ~62 caratteri.
const SEO_TITLES = {
  'autoterm-air-2d-comfort-ris9425': 'Autoterm Air 2D Comfort: riscaldatore a gasolio camper | CDA',
  'cda-0146-autoterm-air-2d-pannello-pu5': 'Autoterm Air 2D PU-5: riscaldatore a gasolio per camper | CDA',
  'cda-0148-kit-autoterm-air-2d-pannello-comfort': 'Kit Autoterm Air 2D Comfort pronto da installare | CDA Tivoli',
  'cda-0144-riscaldatore-a-gasolio-2kw': 'Riscaldatore a gasolio 2 kW per camper e furgone | CDA Tivoli',
  'truma-sl-3004-stf9039': 'Stufa Trumatic S 3004 Truma, accensione automatica | CDA',
  'truma-sl-5004-stf9038': 'Stufa Trumatic S 5004 Truma, accensione automatica | CDA',
  'cda-0140-thermoglas-ducato-windscreen': 'Thermoglas Ducato: oscurante termico parabrezza | CDA Tivoli',
  'cda-0141-thermoglas-xxl-ducato-2006': 'Thermoglas XXL Ducato dal 2006: oscurante termico | CDA Tivoli',
  // Nomi lunghi in categorie con ricerche ("batteria litio camper", "climatizzatore 12v camper"): il tipo davanti, il codice dopo.
  'cda-0172-batteria-litio-ultimatron-ubl-12-100h-pro': 'Batteria al litio camper 100Ah Ultimatron UBL-12-100H-PRO',
  'cda-0173-batteria-litio-ultimatron-ubl-12-200h-pro': 'Batteria al litio camper 200Ah riscaldata Ultimatron UBL PRO',
  'cda-0174-batteria-litio-ultimatron-ubl-12-300h-pro': 'Batteria al litio camper 300Ah riscaldata Ultimatron UBL PRO',
  'cda-0175-batteria-litio-ultimatron-ulm-12-200h': 'Batteria al litio sottosedile camper 200Ah Ultimatron ULM',
  'cda-0176-batteria-litio-ultimatron-ulm-12-310h': 'Batteria al litio sottosedile camper 310Ah Ultimatron ULM',
  'cda-0177-batteria-litio-ultimatron-ulm-12-620': 'Batteria al litio camper 620Ah Ultimatron ULM-12-620 | CDA',
  'cda-0221-victron-multiplus-ii-12-3000-120-32': 'Inverter caricabatterie Victron MultiPlus-II 12/3000 | CDA',
  'cda-0178-climatizzatore-ultimatron-france-ult-12-2000-pac': 'Climatizzatore 12V per camper 2000W Ultimatron | CDA Tivoli',
  'cda-0179-climatizzatore-ultimatron-france-ult-12-2700-pac': 'Climatizzatore 12V per camper 2700W Ultimatron | CDA Tivoli'
};
// Titoli SEO delle categorie (chiave = percorso) e guide da collegare sotto la descrizione della categoria.
const CATEGORY_SEO_TITLES = {
  'clima.riscaldatori-gasolio-gas': 'Riscaldatori a gasolio per camper: Autoterm e Truma | CDA',
  'interni.cabina-guida': 'Oscuranti termici per camper: Thermoglas Ducato | CDA Tivoli'
};
const CATEGORY_GUIDES = {
  'clima.riscaldatori-gasolio-gas': [
    ['guida-riscaldamento-camper.html', 'Riscaldamento camper: gasolio, gas o portatile'],
    ['guida-stufa-truma-s-3004-o-5004.html', 'Stufa Truma S 3004 o 5004: quale scegliere'],
    ['guida-pannello-pu5-o-comfort-autoterm.html', 'Pannello PU-5 o Comfort per Autoterm']
  ],
  'clima': [
    ['guida-riscaldamento-camper.html', 'Riscaldamento camper: gasolio, gas o portatile'],
    ['guida-climatizzatore-camper.html', 'Climatizzatore per camper: come scegliere']
  ],
  'clima.climatizzatori': [['guida-climatizzatore-camper.html', 'Climatizzatore per camper: come scegliere']],
  'interni.cucina': [['guida-frigorifero-camper.html', 'Frigorifero a compressore per camper: come scegliere']],
  'energia': [
    ['guida-batteria-litio-camper.html', 'Batteria al litio per camper: quanti Ah servono'],
    ['guida-fotovoltaico-camper.html', 'Fotovoltaico per camper']
  ],
  'energia.batterie': [
    ['guida-batteria-litio-camper.html', 'Batteria al litio per camper: quanti Ah servono'],
    ['guida-batteria-200ah-ultimatron-extrapower.html', 'Batteria 200 Ah: Ultimatron o ExtraPOWER'],
    ['guida-kit-litio-620ah-promozione.html', 'Kit litio 620 Ah in promozione']
  ],
  'energia.pannelli-solari': [
    ['guida-fotovoltaico-camper.html', 'Fotovoltaico per camper'],
    ['guida-regolatore-mppt-o-pwm.html', 'MPPT o PWM: quale regolatore']
  ],
  'elettronica.inverter-regolatori': [
    ['guida-impianto-elettrico-camper.html', 'Inverter, MPPT e caricabatterie per camper'],
    ['guida-regolatore-mppt-o-pwm.html', 'MPPT o PWM: quale regolatore']
  ],
  'elettronica.caricabatterie': [['guida-impianto-elettrico-camper.html', 'Inverter, MPPT e caricabatterie per camper']],
  'acqua': [['guida-impianto-acqua-camper.html', 'Pompe e serbatoi acqua per camper: come scegliere']],
  'acqua.pompe': [['guida-impianto-acqua-camper.html', 'Pompe e serbatoi acqua per camper: come scegliere']],
  'acqua.serbatoi': [['guida-impianto-acqua-camper.html', 'Pompe e serbatoi acqua per camper: come scegliere']]
};

// Titoli delle altre categorie: tipo di prodotto + "camper", come lo cerca la gente. Max ~62 caratteri.
Object.assign(CATEGORY_SEO_TITLES, {
  'interni': 'Accessori interni per camper: cucina, frigo, toilette | CDA',
  'interni.arredamento': 'Luci LED e arredamento interno per camper | CDA Tivoli',
  'interni.toilette': 'WC portatile e toilette per camper | CDA Tivoli',
  'interni.cucina': 'Frigorifero a compressore e cucina per camper | CDA Tivoli',
  'interni.garage': 'Sistemi garage e fissaggio carico per camper | CDA Tivoli',
  'interni.oscuranti': 'Oscuranti a rullo per finestre camper | CDA Tivoli',
  'interni.zanzariere': 'Zanzariere per porta e finestre camper e van | CDA Tivoli',
  'interni.aperture': 'Fermaporta e ferma porta per camper | CDA Tivoli',
  'interni.utensili': 'Utensili per manutenzione camper | CDA Tivoli',
  'esterni': 'Accessori esterni per camper: verande e sicurezza | CDA',
  'esterni.aperture': 'Aperture esterne per camper | CDA Tivoli',
  'esterni.verande': 'Verande per camper Thule e Fiamma | CDA Tivoli',
  'esterni.portaggio': 'Prese traino 7 e 13 poli per camper | CDA Tivoli',
  'esterni.sicurezza': 'Catadiottri e segnaletica per camper | CDA Tivoli',
  'esterni.illuminazione': 'Luci LED solari da esterno | CDA Tivoli',
  'esterni.adesivi-sigillanti': 'Sigillanti e adesivi per camper NPT | CDA Tivoli',
  'energia': 'Energia per camper: batterie al litio e pannelli solari | CDA',
  'energia.batterie': 'Batterie al litio per camper LiFePO4 | CDA Tivoli',
  'energia.pannelli-solari': 'Pannelli solari per camper | CDA Tivoli',
  'energia.strumentazioni': 'Strumenti di controllo impianto camper | CDA Tivoli',
  'acqua': 'Impianto acqua camper: pompe, serbatoi, rubinetti | CDA',
  'acqua.prodotti-chimici': 'Prodotti chimici per WC camper | CDA Tivoli',
  'acqua.pompe': 'Pompe acqua a immersione per camper | CDA Tivoli',
  'acqua.serbatoi': 'Serbatoi acqua per camper | CDA Tivoli',
  'acqua.rubinetteria': 'Rubinetti e miscelatori per camper | CDA Tivoli',
  'clima': 'Clima camper: climatizzatori e riscaldatori | CDA Tivoli',
  'clima.climatizzatori': 'Climatizzatori per camper Dometic e 12V | CDA Tivoli',
  'clima.bombole-gpl': 'Bombole GPL ricaricabili per camper | CDA Tivoli',
  'elettronica': 'Elettronica per camper: inverter, caricabatterie | CDA',
  'elettronica.avviatori': 'Avviatori di emergenza per camper | CDA Tivoli',
  'elettronica.caricabatterie': 'Caricabatterie e DC/DC per camper | CDA Tivoli',
  'elettronica.monitor-telecamere': 'Telecamere retromarcia e monitor per camper | CDA',
  'elettronica.inverter-regolatori': 'Inverter e regolatori MPPT per camper | CDA Tivoli',
  'elettronica.compressori': 'Compressori portatili 12V | CDA Tivoli',
  'campeggio': 'Articoli da campeggio: tavoli, sedie, fornelli | CDA Tivoli',
  'campeggio.tavoli-sedie': 'Tavoli e sedie da campeggio pieghevoli | CDA Tivoli',
  'campeggio.cucina-campeggio': 'Fornelli e barbecue da campeggio | CDA Tivoli',
  'campeggio.accessori-campeggio': 'Accessori da campeggio: carrelli, doccia | CDA Tivoli'
});

// Titolo SEO automatico per le schede senza titolo scelto a mano: la gente cerca "tipo di prodotto + camper"
// (Search Console), mentre i nomi del catalogo quasi mai contengono "camper". Si aggiunge "per camper"
// (o "da campeggio" nella categoria Campeggio) prima dell'eventuale parentesi finale, solo se il nome non
// dice gia' camper/van/caravan/Ducato. Il nome del prodotto nel carrello e negli ordini non cambia.
const NO_CAMPER_SUFFIX_PATHS = ['esterni.illuminazione'];
function autoSeoTitle(p) {
  const name = String(p.name || '').replace(/\s+/g, ' ').trim();
  const cp = (p.categories && p.categories.path) || '';
  let phrase = '';
  if (cp.indexOf('campeggio') === 0) {
    if (!/campeggio/i.test(name)) phrase = ' da campeggio';
  } else if (NO_CAMPER_SUFFIX_PATHS.indexOf(cp) === -1 && !/48\s?V/i.test(name)
    && !/camper|\bvan\b|caravan|motorhome|ducato|laika/i.test(name)) {
    phrase = ' per camper';
  }
  if (!phrase) return fitTitle(name);
  const m = name.match(/^(.*?)(\s*\([^()]*\))$/);
  const withPhrase = m ? m[1] + phrase + m[2] : name + phrase;
  for (const suffix of [' | CDA Tivoli', ' | CDA']) {
    if ((withPhrase + suffix).length <= 62) return withPhrase + suffix;
  }
  // Nome lungo: meglio il nome con "per camper" senza marchio CDA (Google aggiunge comunque il nome del sito).
  // Google mostra circa 60 caratteri ma legge tutto il titolo: fino a 70 resta utile.
  if (withPhrase.length <= 70) return withPhrase;
  return fitTitle(name);
}

// Costo di spedizione di una sola unita' con le stesse regole del checkout (create-checkout-session):
// gratis da 150 EUR per i colli normali e da 1.500 EUR per il collo lungo (decisione del 24/10/2026), gratis se la
// spedizione e' gia' nel prezzo, fascia "lungo" fissa, fascia "normale" a peso.
// I prodotti su bancale costano di piu' sulle isole: per non dare un prezzo sbagliato restano senza dato.
let SHIPPING_BANDS = [];
function singleUnitShippingCents(p) {
  if (p.ships_on_pallet) return null;
  if (p.shipping_included) return 0;
  const type = p.long_package ? 'lungo' : 'normale';
  if (p.price_cents >= (type === 'normale' ? 15000 : 150000)) return 0;
  const w = p.weight_kg != null ? Number(p.weight_kg) : 0.5;
  const bands = SHIPPING_BANDS.filter(function (b) { return b.package_type === type && b.zona === 'tutte' && Number(b.weight_min_kg) <= w; })
    .sort(function (a, b) { return Number(b.weight_min_kg) - Number(a.weight_min_kg); });
  return bands.length ? bands[0].price_cents : null;
}

// Google accetta uno sku di al massimo 50 caratteri (Search Console: "Lunghezza stringa non valida nel campo sku").
// Sotto i 50 resta lo slug; sopra, i primi 42 caratteri + "-" + 6 caratteri di un hash dello slug (stesso risultato in js/main.js).
function shortSku(slug) {
  const s = String(slug || '');
  if (s.length <= 50) return s;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return s.slice(0, 42).replace(/-+$/, '') + '-' + h.toString(36).padStart(6, '0').slice(-6);
}

function normDesc(d) { return String(d || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

// Guide che citano ogni prodotto: lette dai file guida-*.html già generati (committati nel repo),
// così il collegamento scheda → guida segue sempre le tabelle delle guide, senza duplicarne le regole.
// Serve a Google (link interni pertinenti) e a chi legge (dalla scheda alla guida che spiega la scelta).
let guideLinksCache = null;
function loadGuideLinks() {
  if (guideLinksCache) return guideLinksCache;
  const bySlug = {};
  let files = [];
  // La promozione (guida-kit-*) va per prima: ogni scheda mostra al massimo 2 guide.
  try { files = fs.readdirSync(ROOT).filter((f) => /^guida-.*\.html$/.test(f)).sort((a, b) => (/^guida-kit-/.test(b) - /^guida-kit-/.test(a)) || a.localeCompare(b)); } catch (e) {}
  files.forEach((f) => {
    let src = '';
    try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return; }
    const h1 = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    const label = h1 ? h1[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
    if (!label) return;
    const seen = {};
    const re = /href=["']?(?:\/)?prodotto-([a-z0-9-]+)\.html/g;
    let m;
    while ((m = re.exec(src))) {
      if (seen[m[1]]) continue;
      seen[m[1]] = true;
      (bySlug[m[1]] = bySlug[m[1]] || []).push({ file: f, label: label });
    }
  });
  guideLinksCache = bySlug;
  return bySlug;
}

function guideBoxFor(slug) {
  const guides = (loadGuideLinks()[slug] || []).slice(0, 2);
  if (!guides.length) return '';
  const items = guides.map((g) => '<li><a href="' + g.file + '">' + escapeHtml(g.label) + '</a></li>').join('');
  return '<div class="product-guide-box"><strong>Prima di scegliere</strong><ul>' + items + '</ul></div>';
}

// Link interni statici (visibili anche senza JavaScript): le pagine categoria e prodotto
// mostrano il resto del catalogo via JS, quindi senza questi blocchi Google non vede
// i collegamenti tra categorie, sottocategorie e prodotti. Riempito da main().
let ALL_PRODUCTS = [];

function productsInPath(path) {
  return ALL_PRODUCTS.filter(function (x) { return x.slug && x.categories && x.categories.path === path; });
}

// "Altri prodotti in questa categoria": 4 prodotti della stessa sottocategoria, scelti in modo
// stabile (i successivi per nome, in cerchio) cosi' ogni prodotto riceve link in entrata da altri.
function relatedLinksHtml(p) {
  const path = p.categories && p.categories.path;
  if (!path) return '';
  const same = productsInPath(path).sort(function (a, b) { return a.name.localeCompare(b.name, 'it'); });
  const idx = same.findIndex(function (x) { return x.id === p.id; });
  const picks = [];
  for (let i = 1; i < same.length && picks.length < 4; i++) picks.push(same[(idx + i) % same.length]);
  const segs = path.split('.');
  let out = '';
  if (picks.length) {
    out += '<h3>Altri prodotti in ' + escapeHtml(p.categories.name) + '</h3>\n    <ul>\n' + picks.map(function (x) {
      return '      <li><a href="prodotto-' + x.slug + '.html">' + escapeHtml(x.name) + '</a></li>';
    }).join('\n') + '\n    </ul>\n';
  }
  if (segs.length > 1) {
    out += '    <p>Vedi tutta la categoria: <a href="' + categoryFileName(path) + '">' + escapeHtml(p.categories.name) + '</a></p>\n';
  }
  return out ? '<section class="static-links" aria-label="Altri prodotti">\n  <div class="container">\n    ' + out + '  </div>\n</section>\n\n' : '';
}

function buildPage(template, p, dupDesc) {
  const relPath = 'prodotto-' + p.slug + '.html';
  const pageUrl = SITE_URL + '/' + relPath;
  // Titolo scelto a mano o automatico: passa sempre a js/main.js (CDA_SEO_TITLE), che altrimenti lo riscrive col solo nome.
  const seoTitle = SEO_TITLES[p.slug] || autoSeoTitle(p);
  const title = seoTitle;
  const descSource = p.description
    || (p.name + ' disponibile nello Shop Camper CDA. Spedizione in tutta Italia o ritiro a Tivoli (RM), installazione disponibile nel centro tecnico.');
  const shortDesc = descSource.slice(0, 200);
  // Descrizione meta: unica per pagina e entro ~158 caratteri. Se due prodotti condividono lo stesso testo
  // (es. versione con e senza blister) si antepone il nome, che li distingue.
  const metaBase = (dupDesc && dupDesc.has(normDesc(cutAt(descSource, 158)))) ? (p.name + '. ' + descSource) : descSource;
  const metaDesc = cutAt(metaBase, 158);
  // image_url in Supabase è quasi sempre un URL assoluto (fornitore o
  // Supabase Storage), ma alcune foto caricate a mano (Ultimatron) sono
  // salvate come percorso relativo ("images/prodotti/...") — senza
  // questo controllo og:image finirebbe non risolvibile per chi legge
  // il link (WhatsApp, Facebook non hanno un "sito corrente" da cui
  // completare un URL relativo).
  const imageUrl = p.image_url
    ? (/^https?:\/\//i.test(p.image_url) ? p.image_url : SITE_URL + '/' + p.image_url.replace(/^\//, ''))
    : (SITE_URL + '/images/og-cover.jpg');
  const topSlug = p.categories && p.categories.path ? p.categories.path.split('.')[0] : '';
  const catName = p.categories ? p.categories.name : '';

  // Stesso identico schema del breadcrumb-ld già costruito lato client
  // in updateProductSeoTags() (js/main.js) — tenerli allineati se uno
  // dei due cambia in futuro.
  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
    { '@type': 'ListItem', position: 2, name: 'Shop Camper', item: SITE_URL + '/shop.html' }
  ];
  if (topSlug && catName) {
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: catName, item: SITE_URL + '/categoria-' + topSlug + '.html' });
  }
  breadcrumbItems.push({ '@type': 'ListItem', position: breadcrumbItems.length + 1, name: p.name, item: pageUrl });
  const breadcrumbLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems
  });

  const priceNotSet = !p.price_cents || p.price_cents <= 0;
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    category: catName,
    description: shortDesc,
    image: imageUrl,
    url: pageUrl,
    sku: shortSku(p.slug)
  };
  if (p.brand && p.brand.trim()) productLd.brand = { '@type': 'Brand', name: p.brand.trim() };
  if (p.gtin && /^\d{8,14}$/.test(String(p.gtin).trim())) productLd.gtin = String(p.gtin).trim();
  if (!priceNotSet) {
    productLd.offers = {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: (p.price_cents / 100).toFixed(2),
      availability: p.in_store_only ? 'https://schema.org/InStoreOnly' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: pageUrl,
      seller: { '@type': 'Organization', name: 'CDA', url: SITE_URL + '/' },
      // Reso entro 14 giorni dalla consegna (stessa informazione mostrata nella scheda prodotto e nelle FAQ del sito).
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IT',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        // Termini di vendita, punto 5: reso per posta, spese di restituzione a carico del cliente.
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility'
      }
    };
    const shipCents = p.in_store_only ? null : singleUnitShippingCents(p);
    if (shipCents != null) {
      productLd.offers.shippingDetails = {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: (shipCents / 100).toFixed(2), currency: 'EUR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IT' },
        // Gli stessi valori delle 3 norme di spedizione in Merchant Center (aggiornate il 23/10/2026):
        // preparazione 1-2 giorni lavorativi (Agostino) + transito 2-4 giorni lavorativi (dati Global Service), Lun-Ven.
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY' }
        }
      };
    }
  }

  let html = template;

  // CONTENUTO VISIBILE REALE nel codice della pagina (non solo dopo il JavaScript).
  // Prima il template conteneva i dati di esempio di un "Kit Installazione Pannello Solare"
  // (nome, prezzo, descrizione, lista componenti con "Risparmi 38 EUR") su TUTTE le pagine:
  // chi non esegue il JavaScript (o Google alla prima lettura) vedeva 174 pagine identiche e
  // incoerenti col titolo. js/main.js (renderProductPage) sovrascrive comunque questi valori.
  const topName = (function () {
    try {
      const cats = loadCategoriesDataCached();
      return topSlug && cats[topSlug] ? cats[topSlug].name : catName;
    } catch (e) { return catName; }
  })();
  const priceText = '€ ' + (p.price_cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setById = function (id, inner) {
    const re = new RegExp('(<(\\w+)[^>]*\\bid="' + id + '"[^>]*>)[\\s\\S]*?(</\\2>)');
    html = html.replace(re, function (m, open, tag, close) { return open + inner + close; });
  };
  setById('product-name', escapeHtml(p.name));
  setById('product-breadcrumb-name', escapeHtml(p.name));
  setById('product-cat', escapeHtml(topName && catName && topName !== catName ? topName + ' · ' + catName : catName));
  setById('spec-category', escapeHtml(catName));
  setById('product-desc', escapeHtml(descSource));
  const guideBox = guideBoxFor(p.slug);
  if (guideBox) html = html.replace(/(<p class="desc" id="product-desc"[^>]*>[\s\S]*?<\/p>)/, (m) => m + '\n        ' + guideBox);
  if (!priceNotSet) setById('product-price', '<strong>' + priceText + '</strong>');
  if (topSlug) {
    html = html.replace(/(<a href=")categoria-energia\.html(" id="product-breadcrumb-cat">)[^<]*(<\/a>)/, '$1categoria-' + topSlug + '.html$2' + escapeHtml(topName) + '$3');
  }
  if (p.image_url) {
    setById('product-thumb', '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" style="width:100%;height:100%;object-fit:cover;">');
  }
  // Badge "Kit risparmio" e blocco componenti del kit: solo per i veri kit, e li riempie il JavaScript.
  html = html.replace(/(<span class="product-badge" id="product-badge" style=")([^"]*)(")/, function (m, a, style, c) {
    return a + style + (p.is_bundle ? '' : ';display:none') + c;
  });
  html = html.replace('<div class="kit-contents" id="kit-contents">', '<div class="kit-contents" id="kit-contents" style="display:none;">');
  // Componenti e risparmio di esempio del kit solare: li riscrive interamente js/main.js per i veri kit.
  setById('kit-items-list', '');
  setById('kit-savings', '');

  // Prodotti non spedibili (aerosol, infiammabili): al posto di quantita'/carrello/barra fissa mobile
  // c'e' l'avviso "solo in officina". Vedi anche initStoreOnlyProducts() in js/main.js.
  if (p.in_store_only) {
    const notice = '<div class="store-only-box"><strong>Disponibile solo in officina a Tivoli</strong>'
      + '<p>Per le sue caratteristiche (prodotto infiammabile o sotto pressione) non viene spedito. Passa a ritirarlo da noi in Strada Arci n.24, 00019 Tivoli, oppure '
      + '<a href="tel:+393489905455">chiamaci al 348 990 5455</a> per verificare la disponibilita\'.</p>'
      + '<a href="contatti.html" class="btn btn-primary btn-sm">Orari e contatti</a></div>';
    html = html.replace(/<div class="purchase-row">[\s\S]*?<\/button>\s*<\/div>\s*<div class="buy-trust-row">[\s\S]*?<\/div>/, () => notice);
    html = html.replace(/<div class="buy-bar-sticky" id="buy-bar-sticky">[\s\S]*?<\/div>/, '');
    setById('spec-availability', 'Disponibile solo in officina a Tivoli');
    setById('spec-shipping', 'Non spedibile: ritiro in officina');
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + escapeHtml(title) + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + escapeHtml(metaDesc) + '$2');
  html = html.replace(/(<link rel="canonical" id="canonical-link")(\s*\/?>)/, '$1 href="' + pageUrl + '"$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*("\s*id="og-title")/, '$1' + escapeHtml(title) + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*("\s*id="og-desc")/, '$1' + escapeHtml(shortDesc) + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*("\s*id="og-url")/, '$1' + pageUrl + '$2');
  html = html.replace(/(<meta property="og:image" content=")[^"]*("\s*id="og-image")/, '$1' + imageUrl + '$2');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*("\s*id="twitter-title")/, '$1' + escapeHtml(title) + '$2');
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*("\s*id="twitter-desc")/, '$1' + escapeHtml(shortDesc) + '$2');
  html = html.replace(/(<script type="application\/ld\+json" id="breadcrumb-ld">)[\s\S]*?(<\/script>)/, '$1' + breadcrumbLd + '$2');
  html = html.replace(/(<script type="application\/ld\+json" id="product-ld">)[\s\S]*?(<\/script>)/, '$1' + JSON.stringify(productLd) + '$2');
  const relatedBlock = relatedLinksHtml(p);
  if (relatedBlock) html = html.replace('<footer class="site-footer">', function () { return relatedBlock + '<footer class="site-footer">'; });
  html = html.replace(
    '<script src="js/supabase-config.js"></script>',
    '<script>window.CDA_PRODUCT_ID = "' + escapeJsString(p.id) + '";' + (seoTitle ? ' window.CDA_SEO_TITLE = "' + escapeJsString(seoTitle) + '";' : '') + '</script>\n<script src="js/supabase-config.js"></script>'
  );

  return { relPath, html };
}

async function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const products = await fetchProducts();
  SHIPPING_BANDS = await fetchShippingBands();
  console.log('Prodotti attivi trovati: ' + products.length);
  ALL_PRODUCTS = products;

  // Testi descrizione condivisi da piu' prodotti (varianti blister, frigoriferi gemelli...): servono a rendere unica la meta description.
  const descCount = new Map();
  for (const p of products) { const k = normDesc(cutAt(p.description, 158)); if (k) descCount.set(k, (descCount.get(k) || 0) + 1); }
  const dupDesc = new Set([...descCount].filter(([, n]) => n > 1).map(([k]) => k));

  const generatedFiles = [];
  const redirectLines = [];
  const sitemapUrls = [];

  for (const p of products) {
    if (!p.slug) {
      console.warn('Prodotto senza slug, saltato (non genera pagina statica): ' + p.id + ' ' + p.name);
      continue;
    }
    const { relPath, html } = buildPage(template, p, dupDesc);
    fs.writeFileSync(path.join(ROOT, relPath), html, 'utf8');
    generatedFiles.push(relPath);
    // Sintassi Netlify per un redirect basato su query string: il
    // parametro va in un campo separato ("id=<uuid>"), NON appeso al
    // percorso con "?" (Netlify non lo interpreta come match sulla
    // query). "301!" (col punto esclamativo) forza il redirect anche
    // se esiste un file reale a quel percorso — prodotto.html esiste
    // davvero, senza "!" Netlify servirebbe quel file invece di
    // reindirizzare (shadowing). Bug trovato e spiegato da "Data
    // Analyst CDA" il 28/09/2026 con un test curl in produzione.
    redirectLines.push('/prodotto.html  id=' + p.id + '  /' + relPath + '  301!');
    sitemapUrls.push(
      '  <url>\n' +
      '    <loc>' + SITE_URL + '/' + relPath + '</loc>\n' +
      '    <changefreq>weekly</changefreq>\n' +
      '    <priority>0.5</priority>\n' +
      '  </url>'
    );
  }

  // _redirects: dal vecchio formato ?id= al nuovo URL reale, un redirect
  // 301 per prodotto — protegge i link già condivisi/indicizzati e le
  // fonti esterne che ancora puntano al vecchio formato (feed Google
  // Shopping, email newsletter) senza dover toccare quel codice oggi.
  const redirectsPath = path.join(ROOT, '_redirects');
  const existingLines = fs.existsSync(redirectsPath)
    ? fs.readFileSync(redirectsPath, 'utf8').split('\n').filter(function (l) {
        return l.trim() && !/^\/(prodotto|categoria)(\.html)?\s/.test(l);
      })
    : [];
  const categoryRedirectLines = categoryPaths().map(function (cp) { return '/categoria.html  slug=' + cp + '  /' + categoryFileName(cp) + '  301!'; });
  // Ultime regole (valgono solo se nessuna delle precedenti, con id/slug, ha combaciato): prodotto.html e
  // categoria.html sono i MODELLI da cui si generano le pagine vere e non devono essere visti ne' indicizzati
  // (Gemini e Google li mostravano come pagine del sito, con dati di esempio). Chi arriva li' senza un id
  // valido viene mandato al catalogo / allo shop. Aggiunto il 08/10/2026.
  const templateFallbackLines = [
    '/prodotto.html  /catalogo.html  301!',
    '/prodotto  /catalogo.html  301!',
    '/categoria.html  /shop.html  301!',
    '/categoria  /shop.html  301!'
  ];
  fs.writeFileSync(redirectsPath, existingLines.concat(redirectLines, categoryRedirectLines, templateFallbackLines).join('\n') + '\n', 'utf8');

  // sitemap.xml: sostituisce le vecchie voci prodotto.html?id=... (se
  // presenti da una generazione precedente) con gli URL statici reali.
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/cda-camper\.it\/prodotto(?:\.html\?id=|-)[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/cda-camper\.it\/categoria(?:\.html\?slug=|-)[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  const categoryUrls = categoryPaths().map(function (cp) {
    return '  <url>\n    <loc>' + SITE_URL + '/' + categoryFileName(cp) + '</loc>\n    <changefreq>weekly</changefreq>\n    <priority>' + (cp.indexOf('.') === -1 ? '0.8' : '0.6') + '</priority>\n  </url>';
  });
  sitemap = sitemap.replace('</urlset>', categoryUrls.concat(sitemapUrls).join('\n') + '\n</urlset>\n');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  console.log('Generate ' + generatedFiles.length + ' pagine prodotto statiche.');
  console.log('_redirects e sitemap.xml aggiornati.');

  buildCatalogPage(products);
  buildCategoryPages();
  buildHomeFeatured(products);
}

// Home: i prodotti "in evidenza" nel codice della pagina, con link veri alle schede. Prima c'erano segnaposto
// ("Nome prodotto placeholder") e Google, che legge la home piu' di ogni altra pagina, non trovava nessun link
// a un prodotto. Il JavaScript (initFeaturedCarousel in js/main.js) li sostituisce con gli stessi dati, con carrello.
function buildHomeFeatured(products) {
  const homePath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(homePath)) return;
  let html = fs.readFileSync(homePath, 'utf8');
  if (html.indexOf('<!--HOME-FEATURED-START-->') === -1) return;

  const featured = products
    .filter(function (p) { return p.slug && p.featured && p.price_cents > 0; })
    .sort(function (a, b) { return a.price_cents - b.price_cents; }); // stesso ordine del carosello in js/main.js
  let out = '';
  for (const p of featured) {
    const href = 'prodotto-' + p.slug + '.html';
    const price = '€ ' + (p.price_cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const thumb = p.image_url ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" style="width:100%;height:100%;object-fit:cover;">' : 'Foto prodotto';
    out +=
      '        <div class="product-card promo-card">\n' +
      '          <a class="product-link" href="' + href + '"><div class="product-thumb">' + (p.is_bundle ? '<span class="product-badge">Kit risparmio</span>' : '<span class="product-badge">In evidenza</span>') + thumb + '</div></a>\n' +
      '          <div class="product-body">\n' +
      '            <span class="product-cat">' + escapeHtml(p.categories ? p.categories.name : '') + '</span>\n' +
      '            <a class="product-link" href="' + href + '"><h4>' + escapeHtml(p.name) + '</h4></a>\n' +
      '            <div class="product-price"><strong>' + price + '</strong></div>\n' +
      '          </div>\n' +
      '        </div>\n';
  }
  html = html.replace(/<!--HOME-FEATURED-START-->[\s\S]*?<!--HOME-FEATURED-END-->/, function () { return '<!--HOME-FEATURED-START-->\n' + out + '<!--HOME-FEATURED-END-->'; });
  fs.writeFileSync(homePath, html, 'utf8');
  console.log('index.html aggiornato: ' + featured.length + ' prodotti in evidenza.');
}

// catalogo.html: elenco statico di tutti i prodotti con link normali, così
// Google li trova senza dover eseguire JavaScript (shop e categorie li
// mostrano solo dopo il caricamento da Supabase).
const TOP_CATEGORY_NAMES = {
  interni: 'Interni',
  esterni: 'Esterni',
  energia: 'Energia',
  acqua: 'Acqua',
  clima: 'Clima',
  elettronica: 'Elettronica & Accessori'
};

function buildCatalogPage(products) {
  const catalogPath = path.join(ROOT, 'catalogo.html');
  if (!fs.existsSync(catalogPath)) return;

  const groups = {};
  for (const p of products) {
    if (!p.slug) continue;
    const topSlug = p.categories && p.categories.path ? p.categories.path.split('.')[0] : 'altro';
    const topName = TOP_CATEGORY_NAMES[topSlug] || 'Altro';
    const subName = p.categories ? p.categories.name : 'Altri prodotti';
    const key = topName + '|||' + subName;
    (groups[key] = groups[key] || { topName, subName, topSlug, items: [] }).items.push(p);
  }

  const order = Object.keys(TOP_CATEGORY_NAMES).map(function (k) { return TOP_CATEGORY_NAMES[k]; });
  const sorted = Object.keys(groups).sort(function (a, b) {
    const ga = groups[a], gb = groups[b];
    const oa = order.indexOf(ga.topName), ob = order.indexOf(gb.topName);
    if (oa !== ob) return oa - ob;
    return ga.subName.localeCompare(gb.subName, 'it');
  });

  let out = '';
  let currentTop = '';
  for (const key of sorted) {
    const g = groups[key];
    if (g.topName !== currentTop) {
      currentTop = g.topName;
      out += '    <h2><a href="categoria-' + g.topSlug + '.html" style="color:inherit;">' + escapeHtml(g.topName) + '</a></h2>\n';
    }
    out += '    <h3>' + escapeHtml(g.subName) + '</h3>\n    <ul>\n';
    for (const p of g.items.sort(function (a, b) { return a.name.localeCompare(b.name, 'it'); })) {
      out += '      <li><a href="prodotto-' + p.slug + '.html">' + escapeHtml(p.name) + '</a></li>\n';
    }
    out += '    </ul>\n';
  }

  let html = fs.readFileSync(catalogPath, 'utf8');
  html = html.replace(/<!--CATALOGO-START-->[\s\S]*?<!--CATALOGO-END-->/, '<!--CATALOGO-START-->\n' + out + '<!--CATALOGO-END-->');
  fs.writeFileSync(catalogPath, html, 'utf8');
  console.log('catalogo.html aggiornato: ' + products.length + ' prodotti.');
}

main().catch(function (err) {
  console.error('Build pagine prodotto fallita:', err);
  process.exit(1);
});

// ---- Pagine di categoria statiche -------------------------------------
// Le categorie (nomi, descrizioni, albero) vivono in CATEGORIES_DATA dentro
// js/main.js, la stessa fonte che usa il browser: la leggiamo da li' cosi'
// il build non ha una seconda copia da tenere allineata.
function loadCategoriesData() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  const start = src.indexOf('var CATEGORIES_DATA');
  if (start === -1) throw new Error('CATEGORIES_DATA non trovato in js/main.js');
  const end = src.indexOf('\n};', start);
  const literal = src.slice(src.indexOf('{', start), end + 2);
  return new Function('return ' + literal + ';')();
}

function walkCategories(nodes, prefix, out) {
  Object.keys(nodes).forEach(function (slug) {
    const node = nodes[slug];
    const p = prefix ? prefix + '.' + slug : slug;
    out.push({ path: p, node: node });
    if (node.children) walkCategories(node.children, p, out);
  });
  return out;
}

function categoryPaths() {
  return walkCategories(loadCategoriesData(), '', []).map(function (c) { return c.path; });
}

function categoryFileName(cp) {
  return 'categoria-' + cp.replace(/\./g, '-') + '.html';
}

// Riepilogo reale della categoria (quanti prodotti, quali marchi, da quanto a quanto costano): testo utile a chi
// arriva da Google e piu' contenuto unico su pagine che altrimenti hanno una sola frase. Solo dati del catalogo.
function euro(cents) {
  const parts = (cents / 100).toFixed(cents % 100 ? 2 : 0).split('.');
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (parts[1] ? ',' + parts[1] : '') + ' €';
}
function categoryItems(cp) {
  return ALL_PRODUCTS.filter(function (x) { return x.categories && x.categories.path && (x.categories.path === cp || x.categories.path.indexOf(cp + '.') === 0); });
}
// Versione corta per la meta description: quanti prodotti e il prezzo di partenza.
function categoryMetaSummary(cp) {
  const prices = categoryItems(cp).map(function (x) { return x.price_cents; }).filter(function (c) { return c > 0; });
  if (!prices.length) return '';
  return (prices.length === 1 ? '1 prodotto' : prices.length + ' prodotti') + ' da ' + euro(Math.min.apply(null, prices)) + ', spedizione in tutta Italia o ritiro a Tivoli.';
}
function categorySummary(cp, name) {
  const items = categoryItems(cp);
  if (!items.length) return '';
  const prices = items.map(function (x) { return x.price_cents; }).filter(function (c) { return c > 0; });
  const brands = [];
  items.forEach(function (x) {
    const b = (x.brand || '').trim();
    if (b && b.toUpperCase() !== 'CDA' && brands.indexOf(b) === -1) brands.push(b);
  });
  let out = items.length === 1 ? '1 prodotto' : items.length + ' prodotti';
  out += ' in ' + name;
  if (brands.length) {
    const shown = brands.slice(0, 5);
    out += ' ' + (shown.length === 1 ? 'del marchio ' + shown[0] : 'dei marchi ' + shown.slice(0, -1).join(', ') + ' e ' + shown[shown.length - 1]);
  }
  if (prices.length) {
    const lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
    out += lo === hi ? ', a ' + euro(lo) : ', da ' + euro(lo) + ' a ' + euro(hi);
  }
  return out + '. Spedizione in tutta Italia o ritiro nella nostra officina di Tivoli (RM).';
}

function buildCategoryPages() {
  const template = fs.readFileSync(path.join(ROOT, 'categoria.html'), 'utf8');
  const data = loadCategoriesData();
  const all = walkCategories(data, '', []);
  const nameCount = {};
  all.forEach(function (c) { nameCount[c.node.name] = (nameCount[c.node.name] || 0) + 1; });

  for (const c of all) {
    const segs = c.path.split('.');
    const names = [];
    let nodes = data;
    for (const seg of segs) { names.push({ slug: seg, name: nodes[seg].name }); nodes = nodes[seg].children || {}; }

    const name = c.node.name;
    const rawDesc = c.node.description || (name + ' - accessori per camper, spedizione in tutta Italia, installazione nel centro tecnico CDA di Tivoli.');
    // Meta description: se il testo di categoria e' troppo breve per Google lo si completa con i dati reali del servizio.
    const summary = categorySummary(c.path, name);
    const metaSummary = categoryMetaSummary(c.path);
    const desc = cutAt(rawDesc.length < 120 && metaSummary ? rawDesc.replace(/\.?$/, '.') + ' ' + metaSummary : rawDesc.length < 90 ? rawDesc.replace(/\.?$/, '.') + ' Spedizione in tutta Italia, ritiro gratis a Tivoli.' : rawDesc, 158);
    const file = categoryFileName(c.path);
    const url = SITE_URL + '/' + file;
    // Le sottocategorie con lo stesso nome (es. "Aperture" in Esterni e in Interni) devono avere titoli diversi.
    const parentName = (names.length > 1 && nameCount[name] > 1) ? names[names.length - 2].name : '';
    const title = CATEGORY_SEO_TITLES[c.path] || (name + (parentName ? ' (' + parentName + ')' : '') + ' per camper | CDA Tivoli');
    const seoTitle = title;

    const items = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Shop Camper', item: SITE_URL + '/shop.html' }
    ];
    let acc = '';
    names.forEach(function (n) {
      acc = acc ? acc + '.' + n.slug : n.slug;
      items.push({ '@type': 'ListItem', position: items.length + 1, name: n.name, item: SITE_URL + '/' + categoryFileName(acc) });
    });
    const breadcrumbLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });

    let trail = '<a href="/">Home</a> / <a href="shop.html">Shop Camper</a>';
    acc = '';
    names.forEach(function (n, i) {
      acc = acc ? acc + '.' + n.slug : n.slug;
      trail += i < names.length - 1
        ? ' / <a href="' + categoryFileName(acc) + '">' + escapeHtml(n.name) + '</a>'
        : ' / <span id="breadcrumb-current">' + escapeHtml(n.name) + '</span>';
    });

    let html = template;
    html = html.replace(/(<title id="page-title">)[\s\S]*?(<\/title>)/, '$1' + escapeHtml(title) + '$2');
    html = html.replace(/(<meta id="meta-description" name="description" content=")[^"]*(")/, '$1' + escapeHtml(desc) + '$2');
    html = html.replace(/(<link rel="canonical" href=")[^"]*(" id="canonical-link">)/, '$1' + url + '$2');
    html = html.replace(/(<meta id="og-title" property="og:title" content=")[^"]*(")/, '$1' + escapeHtml(title) + '$2');
    html = html.replace(/(<meta id="og-description" property="og:description" content=")[^"]*(")/, '$1' + escapeHtml(desc) + '$2');
    html = html.replace(/(<meta id="og-url" property="og:url" content=")[^"]*(")/, '$1' + url + '$2');
    html = html.replace(/(<meta id="twitter-title" name="twitter:title" content=")[^"]*(")/, '$1' + escapeHtml(title) + '$2');
    html = html.replace(/(<meta id="twitter-description" name="twitter:description" content=")[^"]*(")/, '$1' + escapeHtml(desc) + '$2');
    html = html.replace(/(<script type="application\/ld\+json" id="breadcrumb-jsonld">)[\s\S]*?(<\/script>)/, '$1' + breadcrumbLd + '$2');
    html = html.replace(/(<h1 id="category-name">)[\s\S]*?(<\/h1>)/, '$1' + escapeHtml(name) + '$2');
    const guideLinks = (CATEGORY_GUIDES[c.path] || []).map(function (g) { return '<a href="' + g[0] + '">' + escapeHtml(g[1]) + '</a>'; });
    const guidesHtml = guideLinks.length ? '\n      <p class="category-guides"><strong>Guide:</strong> ' + guideLinks.join(' · ') + '</p>' : '';
    const summaryHtml = summary ? '\n      <p class="category-guides category-summary">' + escapeHtml(summary) + '</p>' : '';
    html = html.replace(/(<p id="category-desc">)[\s\S]*?(<\/p>)/, function (m, a, b) { return a + escapeHtml(c.node.description || '') + b + summaryHtml + guidesHtml; });
    html = html.replace(/(<div class="breadcrumb" id="breadcrumb">)[\s\S]*?(<\/div>)/, '$1' + trail + '$2');
    // Elenco statico: sottocategorie e prodotti (anche delle sottocategorie) con link normali.
    let staticOut = '';
    const kids = Object.keys(c.node.children || {});
    if (kids.length) {
      staticOut += '<h3>Sottocategorie</h3>\n    <ul>\n' + kids.map(function (k) {
        return '      <li><a href="' + categoryFileName(c.path + '.' + k) + '">' + escapeHtml(c.node.children[k].name) + '</a></li>';
      }).join('\n') + '\n    </ul>\n';
    }
    const listItems = function (arr) {
      return '    <ul>\n' + arr.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'it'); }).map(function (x) {
        return '      <li><a href="prodotto-' + x.slug + '.html">' + escapeHtml(x.name) + '</a></li>';
      }).join('\n') + '\n    </ul>\n';
    };
    const direct = productsInPath(c.path);
    if (direct.length) staticOut += '<h3>Prodotti in ' + escapeHtml(name) + '</h3>\n' + listItems(direct);
    // Le categorie principali elencano solo le sottocategorie (ogni prodotto e' gia' elencato nella sua sottocategoria):
    // cosi' il blocco resta corto. Se una sottocategoria ha a sua volta figli, quei prodotti vanno sulla pagina di livello superiore.
    all.filter(function (d) { return d.path.indexOf(c.path + '.') === 0 && d.path.split('.').length > 2 && d.path.indexOf('.', c.path.length + 1) === -1; }).forEach(function (d) {
      const sub = productsInPath(d.path);
      if (sub.length) staticOut += '<h3><a href="' + categoryFileName(d.path) + '">' + escapeHtml(d.node.name) + '</a></h3>\n' + listItems(sub);
    });
    if (staticOut) {
      const staticBlock = '<section class="static-links" aria-label="Elenco prodotti">\n  <div class="container">\n    <h2>Tutti i prodotti: ' + escapeHtml(name) + '</h2>\n    ' + staticOut + '  </div>\n</section>\n\n';
      html = html.replace('<footer class="site-footer">', function () { return staticBlock + '<footer class="site-footer">'; });
    }
    html = html.replace(
      '<script src="js/supabase-config.js"></script>',
      '<script>window.CDA_CATEGORY_SLUG = "' + escapeJsString(c.path) + '";' + (seoTitle ? ' window.CDA_SEO_TITLE = "' + escapeJsString(seoTitle) + '";' : '') + ' window.CDA_META_DESC = "' + escapeJsString(desc) + '";</script>\n<script src="js/supabase-config.js"></script>'
    );
    fs.writeFileSync(path.join(ROOT, file), html, 'utf8');
  }
  console.log('Generate ' + all.length + ' pagine di categoria statiche.');
}
