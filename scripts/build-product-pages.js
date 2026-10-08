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
  const url = SUPABASE_URL + '/rest/v1/products?select=id,slug,name,description,price_cents,image_url,is_bundle,in_store_only,category_id,categories(name,slug,path)&active=eq.true&order=slug.asc';
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
  return cutAt(name, MAX - ' | CDA Tivoli'.length) + ' | CDA Tivoli';
}

function normDesc(d) { return String(d || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

function buildPage(template, p, dupDesc) {
  const relPath = 'prodotto-' + p.slug + '.html';
  const pageUrl = SITE_URL + '/' + relPath;
  const title = fitTitle(p.name);
  const descSource = p.description
    || (p.name + ' disponibile nello Shop Camper CDA. Spedizione in tutta Italia o ritiro a Tivoli (RM), installazione disponibile nel centro tecnico.');
  const shortDesc = descSource.slice(0, 200);
  // Descrizione meta: unica per pagina e entro ~158 caratteri. Se due prodotti condividono lo stesso testo
  // (es. versione con e senza blister) si antepone il nome, che li distingue.
  const metaBase = (dupDesc && dupDesc.has(normDesc(descSource))) ? (p.name + '. ' + descSource) : descSource;
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
    url: pageUrl
  };
  if (!priceNotSet) {
    productLd.offers = {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: (p.price_cents / 100).toFixed(2),
      availability: p.in_store_only ? 'https://schema.org/InStoreOnly' : 'https://schema.org/InStock',
      url: pageUrl
    };
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
  html = html.replace(
    '<script src="js/supabase-config.js"></script>',
    '<script>window.CDA_PRODUCT_ID = "' + escapeJsString(p.id) + '";</script>\n<script src="js/supabase-config.js"></script>'
  );

  return { relPath, html };
}

async function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const products = await fetchProducts();
  console.log('Prodotti attivi trovati: ' + products.length);

  // Testi descrizione condivisi da piu' prodotti (varianti blister, frigoriferi gemelli...): servono a rendere unica la meta description.
  const descCount = new Map();
  for (const p of products) { const k = normDesc(p.description); if (k) descCount.set(k, (descCount.get(k) || 0) + 1); }
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

function buildCategoryPages() {
  const template = fs.readFileSync(path.join(ROOT, 'categoria.html'), 'utf8');
  const data = loadCategoriesData();
  const all = walkCategories(data, '', []);

  for (const c of all) {
    const segs = c.path.split('.');
    const names = [];
    let nodes = data;
    for (const seg of segs) { names.push({ slug: seg, name: nodes[seg].name }); nodes = nodes[seg].children || {}; }

    const name = c.node.name;
    const rawDesc = c.node.description || (name + ' - accessori per camper, spedizione in tutta Italia, installazione nel centro tecnico CDA di Tivoli.');
    // Meta description: se il testo di categoria e' troppo breve per Google lo si completa con i dati reali del servizio.
    const desc = cutAt(rawDesc.length < 90 ? rawDesc.replace(/\.?$/, '.') + ' Spedizione in tutta Italia, ritiro gratis a Tivoli.' : rawDesc, 158);
    const file = categoryFileName(c.path);
    const url = SITE_URL + '/' + file;
    const title = name + ' — Shop Camper | CDA Tivoli';

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
    html = html.replace(/(<p id="category-desc">)[\s\S]*?(<\/p>)/, '$1' + escapeHtml(c.node.description || '') + '$2');
    html = html.replace(/(<div class="breadcrumb" id="breadcrumb">)[\s\S]*?(<\/div>)/, '$1' + trail + '$2');
    html = html.replace(
      '<script src="js/supabase-config.js"></script>',
      '<script>window.CDA_CATEGORY_SLUG = "' + escapeJsString(c.path) + '";</script>\n<script src="js/supabase-config.js"></script>'
    );
    fs.writeFileSync(path.join(ROOT, file), html, 'utf8');
  }
  console.log('Generate ' + all.length + ' pagine di categoria statiche.');
}
