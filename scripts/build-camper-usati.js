// Genera la sezione "Camper usati": camper-usati.html (elenco) e una pagina per ogni veicolo.
// Per aggiungere un camper: inserire una voce in CAMPER qui sotto e le foto in images/camper-usati/
// (targhe oscurate, niente volti), poi fare push. Le pagine entrano da sole nella sitemap.
//
// Uso (eseguito anche da Netlify, vedi netlify.toml):  node scripts/build-camper-usati.js

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://cda-camper.it';
const ROOT = path.join(__dirname, '..');
const TEL_DISPLAY = '348 990 5455';
const TEL_HREF = 'tel:+393489905455';
const EMAIL = 'info@cda-camper.it';

const CAMPER = [
  {
    slug: 'adria-mansardato-2005',
    title: 'Adria mansardato su Fiat Ducato, anno 2005',
    shortTitle: 'Adria mansardato 2005',
    metaTitle: 'Camper usato Adria mansardato 2005 | CDA Tivoli',
    summary: 'Letto matrimoniale in coda e garage. 46.196 km.',
    metaDescription: 'Camper usato Adria mansardato su Fiat Ducato del 2005, 46.196 km, letto matrimoniale in coda e garage. Trattativa in privato, contatta CDA a Tivoli.',
    price: 'Trattativa in privato',
    specs: [
      ['Marca', 'Adria'],
      ['Tipologia', 'Mansardato'],
      ['Base', 'Fiat Ducato'],
      ['Anno', '2005'],
      ['Chilometri', '46.196 km (come da contachilometri)'],
      ['Letto', 'Matrimoniale in coda'],
      ['Garage', 'Sì'],
      ['Prezzo', 'Trattativa in privato']
    ],
    description: [
      'Camper Adria mansardato del 2005 su base Fiat Ducato, con letto matrimoniale in coda e garage. Secondo la scheda del venditore è in ottimo stato, pronto a partire e senza lavori da eseguire.',
      'All\'interno ci sono la dinette con tavolo, la cucina con forno, un monitor TV orientabile, un oblò sul tetto e il letto della mansarda sopra la cabina.'
    ],
    photos: [
      ['adria-2005-01.jpg', 'Camper Adria mansardato su Fiat Ducato, vista anteriore sinistra'],
      ['adria-2005-02.jpg', 'Camper Adria mansardato, vista anteriore e mansarda'],
      ['adria-2005-03.jpg', 'Camper Adria mansardato, vista frontale'],
      ['adria-2005-04.jpg', 'Interno: divano, cabina di guida e mansarda con tende'],
      ['adria-2005-05.jpg', 'Interno: dinette con tavolo e monitor TV'],
      ['adria-2005-06.jpg', 'Interno: zona pranzo, pensili e oblò sul tetto'],
      ['adria-2005-07.jpg', 'Interno: tavolo e sedile della cabina di guida'],
      ['adria-2005-08.jpg', 'Cucina con forno'],
      ['adria-2005-09.jpg', 'Cruscotto con 46.196 km totali']
    ],
    note: 'Le informazioni sono quelle fornite dal venditore e quelle che si vedono nelle foto: prima dell\'acquisto il camper si può vedere di persona e controllare con i nostri tecnici.'
  },
  {
    slug: 'arca-america-430',
    title: 'Arca America 430 mansardato del 1995 su Fiat Ducato Maxi',
    shortTitle: 'Arca America 430',
    metaTitle: 'Camper usato Arca America 430 del 1995, 19.000 € | CDA Tivoli',
    summary: 'Motore 2500 TD, 116.265 km, lunghezza 6,98 m. Bagno con doccia e cucina a quattro fuochi.',
    metaDescription: 'Camper usato Arca America 430 mansardato del 1995 a 19.000 euro, 116.265 km, motore 2500 TD, lunghezza 6,98 m. Contatta CDA a Tivoli per vederlo.',
    price: '19.000 €',
    specs: [
      ['Marca e modello', 'Arca America 430'],
      ['Tipologia', 'Mansardato'],
      ['Base', 'Fiat Ducato Maxi'],
      ['Anno', '1995'],
      ['Chilometri', '116.265 km'],
      ['Motore', '2500 TD'],
      ['Lunghezza', '6,98 m'],
      ['Cucina', 'Piano cotto a 4 fuochi, doppio lavello'],
      ['Bagno', 'Lavabo angolare, WC e doccia'],
      ['Prezzo', '19.000 €']
    ],
    description: [
      'Camper Arca America 430 mansardato del 1995 su base Fiat Ducato Maxi con motore 2500 TD, 116.265 km, lunghezza 6,98 m e scaletta posteriore. Le foto mostrano la cucina con piano cotto a quattro fuochi e doppio lavello, il bagno con lavabo angolare, WC e doccia, il letto sopra la cabina con le tende, un armadio, i pensili in legno e una stufa a gas.'
    ],
    photos: [
      ['arca-america-430-01.jpg', 'Camper Arca America 430, fianco destro con scaletta e finestra'],
      ['arca-america-430-02.jpg', 'Camper Arca America 430, fiancata e parte posteriore'],
      ['arca-america-430-03.jpg', 'Camper Arca America 430, vista posteriore con la scritta America 430'],
      ['arca-america-430-04.jpg', 'Cucina con piano cotto a quattro fuochi'],
      ['arca-america-430-05.jpg', 'Doppio lavello della cucina'],
      ['arca-america-430-06.jpg', 'Letto sopra la cabina con tende e dinette'],
      ['arca-america-430-07.jpg', 'Armadio e zona notte posteriore'],
      ['arca-america-430-08.jpg', 'Pensili in legno sopra la dinette'],
      ['arca-america-430-09.jpg', 'Stufa a gas'],
      ['arca-america-430-10.jpg', 'Bagno con WC e lavabo angolare']
    ],
    note: 'Le informazioni sono quelle che si vedono nelle foto: prima dell\'acquisto il camper si può vedere di persona e controllare con i nostri tecnici.'
  },
  {
    slug: 'laika-ecovip-1995',
    title: 'Laika Ecovip mansardato del 1995, motore rifatto e batteria al litio',
    shortTitle: 'Laika Ecovip 1995',
    metaTitle: 'Camper usato Laika Ecovip 1995, 19.000 € | CDA Tivoli',
    summary: '6 posti in viaggio, 7 posti letto, 6,80 m. Motore rifatto, climatizzatore con pompa di calore, batteria al litio.',
    metaDescription: 'Camper usato Laika Ecovip del 1995 a 19.000 euro: motore rifatto, gomme nuove, climatizzatore con pompa di calore, batteria al litio e inverter a onda pura. Contatta CDA a Tivoli.',
    price: '19.000 €',
    specs: [
      ['Marca e modello', 'Laika Ecovip'],
      ['Tipologia', 'Mansardato'],
      ['Anno', '1995'],
      ['Chilometri', '188.564 km al contachilometri, con motore rifatto'],
      ['Lunghezza', '6,80 m'],
      ['Posti in viaggio', '6'],
      ['Posti letto', '7'],
      ['Prezzo', '19.000 €']
    ],
    description: [
      'Camper Laika Ecovip mansardato del 1995, lungo 6,80 m, con 6 posti in viaggio e 7 posti letto. Il contachilometri segna 188.564 km, ma il motore è stato rifatto completamente. È controllato, efficiente e pronto a partire.',
      'Lavori eseguiti e confermati da CDA: motore rifatto completamente, pompa compresa; gomme nuove; climatizzatore da tetto con pompa di calore; impianto con batteria al litio; inverter a onda pura da 2000/4000 W con by-pass; retrocamera e terzo occhio; 10 prese USB; antenna TV e TV smart a 12 V.'
    ],
    photos: [
      ['laika-ecovip-1995-01.jpg', 'Camper Laika Ecovip del 1995, vista anteriore dall\'alto'],
      ['laika-ecovip-1995-02.jpg', 'Camper Laika Ecovip dall\'alto, con climatizzatore e pannello solare sul tetto'],
      ['laika-ecovip-1995-03.jpg', 'Interno: dal fondo verso la cabina, con cucina e zona giorno'],
      ['laika-ecovip-1995-04.jpg', 'Interno: cucina con lavello e piano di lavoro'],
      ['laika-ecovip-1995-05.jpg', 'Zona giorno con dinette e, sopra la cabina, il letto della mansarda'],
      ['laika-ecovip-1995-06.jpg', 'Letto della mansarda sopra la cabina'],
      ['laika-ecovip-1995-07.jpg', 'Interno visto dall\'alto: cucina e dinette'],
      ['laika-ecovip-1995-08.jpg', 'Bagno con WC, doppio lavabo e doccia']
    ],
    note: 'Le informazioni sono quelle fornite dal venditore e quelle che si vedono nelle foto: prima dell\'acquisto il camper si può vedere di persona e controllare con i nostri tecnici.'
  }
];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function siteShell() {
  const src = fs.readFileSync(path.join(ROOT, 'chi-siamo.html'), 'utf8');
  const headerStart = src.indexOf('<header class="site-header">');
  const headEnd = src.indexOf('<div class="page-head compact">');
  const footerStart = src.indexOf('<footer class="site-footer">');
  if (headerStart < 0 || headEnd < 0 || footerStart < 0) throw new Error('chi-siamo.html: struttura cambiata, impossibile estrarre header/footer');
  return {
    header: src.slice(headerStart, headEnd).replace('<li class="current"><a href="chi-siamo.html">', '<li><a href="chi-siamo.html">'),
    footer: src.slice(footerStart)
  };
}

function page(shell, o) {
  const url = SITE_URL + '/' + o.file;
  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
    { '@type': 'ListItem', position: 2, name: 'Camper usati', item: SITE_URL + '/camper-usati.html' }
  ];
  if (o.crumbName) crumbs.push({ '@type': 'ListItem', position: 3, name: o.crumbName, item: url });
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs });
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="icon" type="image/png" sizes="96x96" href="images/favicon-96.png">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CDA">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/${o.ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<link rel="stylesheet" href="stile.css">
<script type="application/ld+json">
${ld}
</script>
</head>
<body>

${shell.header}<div class="page-head compact">
  <div class="container">
    <div class="breadcrumb-row">
      <div class="breadcrumb"><a href="/">Home</a> / ${o.crumbName ? '<a href="camper-usati.html">Camper usati</a> / ' + esc(o.crumbName) : 'Camper usati'}</div>
    </div>
    <div class="compact-head-row">
      <h1>${esc(o.h1)}</h1>
      <p>${esc(o.lead)}</p>
    </div>
  </div>
</div>

<section>
  <div class="container">
${o.body}
  </div>
</section>

${shell.footer}`;
}

function cardHtml(c) {
  return `      <article class="product-card used-card">
        <a class="product-link" href="camper-usato-${esc(c.slug)}.html">
          <div class="product-thumb"><img src="images/camper-usati/${esc(c.photos[0][0])}" alt="${esc(c.photos[0][1])}" loading="lazy" style="width:100%;height:100%;object-fit:cover;"></div>
        </a>
        <div class="product-body">
          <span class="product-cat">Camper usato · ${esc(c.specs.find((s) => s[0] === 'Anno')[1])}</span>
          <a class="product-link" href="camper-usato-${esc(c.slug)}.html"><h4>${esc(c.title)}</h4></a>
          <p style="margin:0 0 6px;">${esc(c.summary)}</p>
          <div class="product-price"><strong style="font-size:16px;">${esc(c.price)}</strong><a href="camper-usato-${esc(c.slug)}.html" class="btn btn-outline btn-sm">Vedi scheda</a></div>
        </div>
      </article>`;
}

// Blocco della home: elenca fino a 4 camper e rimanda alla pagina completa.
// Vive tra i commenti CAMPER-USATI-HOME in index.html (inseriti una sola volta da scripts/apply-camper-nav.js).
function homeBlock() {
  return `<!-- CAMPER-USATI-HOME:START -->
<section id="camper-usati" style="background:var(--white);border-top:1px solid var(--line);border-bottom:1px solid var(--line);">
  <div class="container">
    <div class="section-head">
      <div>
        <span class="tag">Occasioni</span>
        <h2>Camper usati in vendita</h2>
      </div>
      <a href="camper-usati.html" class="btn btn-outline btn-sm">Vedi tutti i camper usati</a>
    </div>
    <div class="product-grid">
${CAMPER.slice(0, 4).map(cardHtml).join('\n')}
    </div>
  </div>
</section>
<!-- CAMPER-USATI-HOME:END -->`;
}

function injectHome() {
  const p = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(p, 'utf8');
  const a = src.indexOf('<!-- CAMPER-USATI-HOME:START -->');
  const b = src.indexOf('<!-- CAMPER-USATI-HOME:END -->');
  if (a < 0 || b < 0) return false;
  fs.writeFileSync(p, src.slice(0, a) + homeBlock() + src.slice(b + '<!-- CAMPER-USATI-HOME:END -->'.length), 'utf8');
  return true;
}

function listBody() {
  const cards = CAMPER.map(cardHtml).join('\n');
  return `    <div class="product-grid">
${cards}
    </div>
    <div class="guide-body" style="margin-top:36px;">
      <h2>Cerchi un camper usato?</h2>
      <p>Qui trovi i camper che abbiamo in vendita. Se ne stai cercando uno in particolare, o vuoi sapere se arriverà qualcosa di nuovo, chiamaci al <a href="${TEL_HREF}">${TEL_DISPLAY}</a> oppure scrivici a <a href="mailto:${EMAIL}">${EMAIL}</a>: lo diciamo ai nostri tecnici e ti avvisiamo.</p>
    </div>`;
}

function detailBody(c) {
  const thumbs = c.photos.map((p, i) => `<button type="button" class="used-thumb${i === 0 ? ' is-active' : ''}" data-src="images/camper-usati/${esc(p[0])}" data-alt="${esc(p[1])}" aria-label="Foto ${i + 1}"><img src="images/camper-usati/${esc(p[0])}" alt="${esc(p[1])}" loading="lazy"></button>`).join('\n          ');
  const specs = c.specs.map((s) => `<tr><th scope="row">${esc(s[0])}</th><td>${esc(s[1])}</td></tr>`).join('\n          ');
  return `    <div class="used-detail">
      <div class="used-gallery">
        <img id="used-main" class="used-main" src="images/camper-usati/${esc(c.photos[0][0])}" alt="${esc(c.photos[0][1])}">
        <div class="used-thumbs">
          ${thumbs}
        </div>
      </div>
      <div class="guide-body used-info">
        <h2 style="margin-top:0;">Scheda</h2>
        <div class="guide-table-wrap">
          <table class="guide-table">
            <caption>Dati del camper usato (da scheda del venditore e dalle foto)</caption>
            <tbody>
          ${specs}
            </tbody>
          </table>
        </div>
        ${c.description.map((p) => '<p>' + esc(p) + '</p>').join('\n        ')}
        <div class="guide-note"><strong>Vuoi vederlo o avere altre informazioni?</strong> Chiamaci al <a href="${TEL_HREF}">${TEL_DISPLAY}</a> o scrivi a <a href="mailto:${EMAIL}">${EMAIL}</a>. ${esc(c.note)}</div>
        <div class="guide-links">
          <a href="contatti.html" class="btn btn-primary btn-sm">Contattaci</a>
          <a href="camper-usati.html" class="btn btn-outline btn-sm">Tutti i camper usati</a>
        </div>
      </div>
    </div>
    <script>
      (function () {
        var main = document.getElementById('used-main');
        document.querySelectorAll('.used-thumb').forEach(function (b) {
          b.addEventListener('click', function () {
            main.src = b.getAttribute('data-src');
            main.alt = b.getAttribute('data-alt');
            document.querySelectorAll('.used-thumb').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
          });
        });
      })();
    </script>`;
}

function main() {
  const shell = siteShell();
  const files = [];

  fs.writeFileSync(path.join(ROOT, 'camper-usati.html'), page(shell, {
    file: 'camper-usati.html',
    title: 'Camper usati in vendita | CDA Tivoli',
    description: 'Camper usati in vendita da CDA a Tivoli: schede con foto, chilometri e anno. Contattaci per vederli e trattare.',
    ogImage: 'images/camper-usati/' + CAMPER[0].photos[0][0],
    h1: 'Camper usati in vendita',
    lead: 'I camper usati che abbiamo disponibili, con foto e dati. Per vederli o trattare, contattaci.',
    body: listBody()
  }), 'utf8');
  files.push('camper-usati.html');

  CAMPER.forEach((c) => {
    const file = 'camper-usato-' + c.slug + '.html';
    fs.writeFileSync(path.join(ROOT, file), page(shell, {
      file,
      title: c.metaTitle,
      description: c.metaDescription,
      ogImage: 'images/camper-usati/' + c.photos[0][0],
      crumbName: c.shortTitle,
      h1: c.title,
      lead: c.summary + ' ' + c.price + '.',
      body: detailBody(c)
    }), 'utf8');
    files.push(file);
  });

  const homeOk = injectHome();
  if (homeOk) console.log('Home aggiornata con i camper usati.');
  if (process.argv.includes('--no-sitemap')) { console.log('Generate ' + files.length + ' pagine camper usati (sitemap non toccata).'); return; }
  // sitemap: rimuove le vecchie voci camper e le riaggiunge
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/cda-camper\.it\/camper-usat[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  const entries = files.map((f) => `  <url>\n    <loc>${SITE_URL}/${f}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
  sitemap = sitemap.replace('</urlset>', entries.join('\n') + '\n</urlset>\n');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  console.log('Generate ' + files.length + ' pagine camper usati + sitemap.');
}

main();
