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
  const url = SUPABASE_URL + '/rest/v1/products?select=id,slug,name,description,price_cents,image_url,category_id,categories(name,slug,path)&active=eq.true&order=slug.asc';
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

function buildPage(template, p) {
  const relPath = 'prodotto-' + p.slug + '.html';
  const pageUrl = SITE_URL + '/' + relPath;
  const title = p.name + ' | Shop CDA Tivoli';
  const descSource = p.description
    || (p.name + ' disponibile nello Shop Camper CDA. Spedizione in tutta Italia o ritiro a Tivoli (RM), installazione disponibile nel centro tecnico.');
  const shortDesc = descSource.slice(0, 200);
  const metaDesc = descSource.slice(0, 300);
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
    breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: catName, item: SITE_URL + '/categoria.html?slug=' + topSlug });
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
      availability: 'https://schema.org/InStock',
      url: pageUrl
    };
  }

  let html = template;
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

  const generatedFiles = [];
  const redirectLines = [];
  const sitemapUrls = [];

  for (const p of products) {
    if (!p.slug) {
      console.warn('Prodotto senza slug, saltato (non genera pagina statica): ' + p.id + ' ' + p.name);
      continue;
    }
    const { relPath, html } = buildPage(template, p);
    fs.writeFileSync(path.join(ROOT, relPath), html, 'utf8');
    generatedFiles.push(relPath);
    redirectLines.push('/prodotto.html?id=' + p.id + '  /' + relPath + '  301');
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
        return l.trim() && l.indexOf('/prodotto.html?id=') !== 0;
      })
    : [];
  fs.writeFileSync(redirectsPath, existingLines.concat(redirectLines).join('\n') + '\n', 'utf8');

  // sitemap.xml: sostituisce le vecchie voci prodotto.html?id=... (se
  // presenti da una generazione precedente) con gli URL statici reali.
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/cda-camper\.it\/prodotto(?:\.html\?id=|-)[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  sitemap = sitemap.replace('</urlset>', sitemapUrls.join('\n') + '\n</urlset>\n');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');

  console.log('Generate ' + generatedFiles.length + ' pagine prodotto statiche.');
  console.log('_redirects e sitemap.xml aggiornati.');
}

main().catch(function (err) {
  console.error('Build pagine prodotto fallita:', err);
  process.exit(1);
});
