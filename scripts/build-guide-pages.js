// ============================================================
// scripts/build-guide-pages.js
//
// COSA FA:
// Genera le guide all'acquisto (guida-*.html): pagine di testo utili per chi
// cerca "come scegliere..." e che portano ai prodotti veri. Le tabelle con
// modelli e PREZZI sono costruite qui dal catalogo reale su Supabase, ad ogni
// deploy: cosi' i prezzi in una guida non restano mai vecchi.
// Il resto (testi) usa solo informazioni presenti nelle schede prodotto o
// ragionamenti generali: nessuna misura, prestazione o confronto inventato.
//
// COME GIRA: dopo build-product-pages.js, nel comando di build di netlify.toml.
// Rigenera anche le voci delle guide in sitemap.xml.
// ============================================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://udynqqqxjcyhdeygqumi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xjJru5AOW6V242H2L7rZTg_Lg6zXYw5';
const SITE_URL = 'https://cda-camper.it';
const ROOT = path.join(__dirname, '..');
// Stessa soglia di create-checkout-session / js/main.js (spedizione gratuita da 1.500 €).
const FREE_SHIPPING_THRESHOLD_CENTS = 150000;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (cents) => (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

async function fetchProducts(nameFilter) {
  const url = SUPABASE_URL + '/rest/v1/products?select=name,slug,brand,price_cents,shipping_included,description'
    + '&active=eq.true&price_cents=gt.0&' + nameFilter + '&order=price_cents.asc';
  const res = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
  if (!res.ok) throw new Error('Fetch prodotti per guide fallita: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

// Guscio del sito (menu, ricerca, footer) preso da chi-siamo.html, cosi' le guide restano sempre uguali al resto.
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

function pageHtml(shell, g) {
  const url = SITE_URL + '/' + g.file;
  const breadcrumb = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Shop Camper', item: SITE_URL + '/shop.html' },
      { '@type': 'ListItem', position: 3, name: g.shortTitle, item: url }
    ]
  });
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="icon" type="image/png" sizes="96x96" href="images/favicon-96.png">
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(g.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="CDA">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="${esc(g.title)}">
<meta property="og:description" content="${esc(g.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/images/og-cover.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(g.title)}">
<meta name="twitter:description" content="${esc(g.description)}">
<link rel="stylesheet" href="stile.css">
<script type="application/ld+json">
${breadcrumb}
</script>
</head>
<body>

${shell.header}<div class="page-head compact">
  <div class="container">
    <div class="breadcrumb-row">
      <div class="breadcrumb"><a href="/">Home</a> / <a href="shop.html">Shop Camper</a> / ${esc(g.shortTitle)}</div>
    </div>
    <div class="compact-head-row">
      <h1>${esc(g.h1)}</h1>
      <p>${esc(g.lead)}</p>
    </div>
  </div>
</div>

<section>
  <div class="container">
    <div class="guide-body">
${g.body}
    </div>
  </div>
</section>

<div class="cta-band">
  <div class="container">
    <h2>Non sai quale scegliere?</h2>
    <p>Dicci che camper hai e come lo usi: ti consigliamo il modello giusto prima di ordinare. Chiamaci al 348 990 5455 o scrivici dal sito.</p>
    <a href="contatti.html" class="btn btn-outline on-dark">Chiedi un consiglio</a>
  </div>
</div>

${shell.footer}`;
}

function tableRows(rows) {
  return rows.map((r) => `<tr>${r.map((c, i) => `<td${i === r.length - 2 ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('\n');
}

function shippingNote(p) {
  if (p.shipping_included) return 'Spedizione inclusa nel prezzo';
  if (p.price_cents >= FREE_SHIPPING_THRESHOLD_CENTS) return 'Spedizione gratuita';
  return 'Spedizione calcolata nel carrello';
}

// ---------- Guida 1: climatizzatori ----------
function climateNote(name) {
  if (/Freshlight/i.test(name)) return 'Integra un oblò apribile: oltre al raffrescamento porta luce e aria';
  if (/Freshwell/i.test(name)) return 'La massima potenza tra i modelli a catalogo, per i camper più esigenti';
  if (/FJZ7/i.test(name)) return 'Tecnologia inverter: raffrescamento potente, silenzioso e a basso consumo';
  if (/FJZ4/i.test(name)) return 'Installazione a incasso sul tetto, funzionamento silenzioso';
  if (/1500/.test(name)) return 'Soluzione compatta, per camper di dimensioni contenute';
  if (/1700/.test(name)) return 'Potenza intermedia per rinfrescare comodamente il camper';
  if (/2200/.test(name)) return 'Il top della gamma FreshJet, per rinfrescare rapidamente anche i camper più grandi';
  return '';
}

function buildClimateGuide(products) {
  const list = products.filter((p) => /freshjet|freshlight|freshwell/i.test(p.name));
  if (list.length === 0) throw new Error('Guida climatizzatori: nessun prodotto Dometic trovato nel catalogo');
  const powerOf = (p) => Number((p.name.match(/(?<!\d)(1500|1700|2200|3000)(?!\d)/) || [])[1] || 0);
  list.sort((a, b) => powerOf(a) - powerOf(b) || a.price_cents - b.price_cents); // per potenza, poi per prezzo
  const rows = list.map((p) => {
    const power = (p.name.match(/(?<!\d)(1500|1700|2200|3000)(?!\d)/) || [])[1];
    const finish = /nero/i.test(p.name) ? 'Nero' : /bianco/i.test(p.name) ? 'Bianco' : '—';
    return [
      `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`,
      power ? power + ' W' : '—',
      finish,
      esc(climateNote(p.name)),
      eur(p.price_cents),
      esc(shippingNote(p))
    ];
  });
  const cheapest = Math.min.apply(null, list.map((p) => p.price_cents));
  const allFree = cheapest >= FREE_SHIPPING_THRESHOLD_CENTS;
  return {
    file: 'guida-climatizzatore-camper.html',
    shortTitle: 'Guida al climatizzatore per camper',
    title: 'Climatizzatore per camper Dometic: come scegliere | CDA Tivoli',
    description: 'Guida al climatizzatore da tetto Dometic per camper: differenze tra FreshJet 1500, 1700 e 2200 W, Freshlight e Freshwell, prezzi aggiornati, spedizione e installazione a Tivoli.',
    h1: 'Climatizzatore per camper: come scegliere il modello giusto',
    lead: 'Le differenze tra i climatizzatori da tetto Dometic che vendiamo, con prezzi aggiornati e le domande da farsi prima di ordinare.',
    body: `      <p>Un climatizzatore da tetto è uno degli acquisti più importanti per un camper: costa, si installa una volta sola e si vive tutta l'estate. Qui trovi i modelli <strong>Dometic</strong> che teniamo a catalogo, in che cosa si differenziano e come orientarti. I prezzi nella tabella vengono letti dal nostro catalogo e si aggiornano da soli.</p>

      <h2>I modelli a confronto</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Potenza</th><th>Finitura</th><th>Per chi</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(rows)}
          </tbody>
        </table>
      </div>
      <p>Prezzi IVA inclusa, da ${eur(cheapest)}. Il ritiro in officina a Tivoli è sempre gratuito.</p>

      <h2>Come scegliere la potenza</h2>
      <ul>
        <li><strong>Le dimensioni del camper contano.</strong> Il 1500 W è la scelta compatta per mezzi di dimensioni contenute; il 2200 W è pensato per i camper più grandi. Il 1700 W sta nel mezzo.</li>
        <li><strong>Pensa a dove viaggi.</strong> Se passi l'estate in zone molto calde, una potenza maggiore raffresca più in fretta lo stesso ambiente.</li>
        <li><strong>Controlla l'apertura sul tetto.</strong> I modelli a incasso (FJZ4, FJZ7) e quello con oblò (Freshlight) si montano in un'apertura esistente o da predisporre: la posizione e lo spazio vanno valutati sul tuo camper.</li>
        <li><strong>Pensa all'alimentazione.</strong> In genere un climatizzatore da tetto lavora a 230 V: serve la presa in campeggio oppure un impianto con inverter e batterie dimensionati. Se vuoi usarlo anche fuori rete, parlane con noi prima di scegliere.</li>
      </ul>

      <div class="guide-note"><strong>Non sei sicuro della compatibilità con il tuo camper?</strong> Chiamaci al <a href="tel:+393489905455">348 990 5455</a>: ti diciamo se il modello è adatto prima che tu ordini.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia:</strong> ${allFree ? 'i climatizzatori a catalogo superano la soglia di 1.500 €, quindi la spedizione è gratuita.' : 'gratuita sopra 1.500 €, altrimenti calcolata nel carrello.'}</li>
        <li><strong>Ritiro gratis in officina a Tivoli:</strong> puoi ordinare online e passare a ritirarlo da noi, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico:</strong> se acquisti il climatizzatore da noi, lo installiamo, lo colleghiamo e lo collaudiamo a Tivoli. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
        <dt>Quale potenza serve per un camper piccolo?</dt>
        <dd>Per i mezzi di dimensioni contenute la soluzione compatta è il FreshJet da 1500 W. Per i camper più grandi trovi il 2200 W e, tra i modelli a catalogo, il Freshwell da 3000 W.</dd>
        <dt>Che differenza c'è tra bianco e nero?</dt>
        <dd>Per i modelli FreshJet la differenza è la finitura (bianco o nero): scegli quella che si abbina meglio al tuo camper.</dd>
        <dt>Lo montate voi?</dt>
        <dd>Sì, se lo acquisti da noi. L'installazione si fa nel nostro centro tecnico a Tivoli (Strada Arci n.24).</dd>
        <dt>Posso ritirarlo di persona?</dt>
        <dd>Sì, il ritiro in officina è gratuito: scegli "Ritiro in officina" nel carrello.</dd>
      </dl>

      <div class="guide-links">
        <a href="categoria-clima-climatizzatori.html" class="btn btn-primary btn-sm">Vedi tutti i climatizzatori</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
      </div>`
  };
}

// ---------- Guida 2: batterie al litio ----------
function batteryNote(p) {
  const bits = [];
  if (/Ultimatron/i.test(p.brand || p.name)) {
    if (/UBL/i.test(p.name)) bits.push('BMS intelligente e Bluetooth');
    if (/Riscaldatore/i.test(p.name)) bits.push('lamine riscaldanti: ricarica fino a −35 °C');
    if (/ULM/i.test(p.name) && /Sottosedile/i.test(p.name)) bits.push('custodia ribassata per il sottosedile, IP62');
    if (/ULM-12-620/i.test(p.name)) bits.push('massima capacità della gamma ULM');
  } else {
    bits.push('batteria LiFePO4');
  }
  return bits.join('; ');
}

function buildBatteryGuide(products) {
  const list = products.filter((p) => /^Batteria/i.test(p.name));
  if (list.length === 0) throw new Error('Guida batterie: nessuna batteria trovata nel catalogo');
  const rows = list.map((p) => {
    const ah = (p.name.match(/(\d+)\s?Ah/i) || [])[1];
    const wh = ((p.description || '').match(/\(([\d.]+)\s?Wh\)/) || [])[1];
    return [
      `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`,
      ah ? ah + ' Ah' : '—',
      wh ? wh + ' Wh' : '—',
      esc(batteryNote(p)),
      eur(p.price_cents),
      esc(shippingNote(p))
    ];
  });
  return {
    file: 'guida-batteria-litio-camper.html',
    shortTitle: 'Guida alle batterie al litio per camper',
    title: 'Batteria al litio per camper: quanti Ah servono | CDA Tivoli',
    description: 'Come scegliere la batteria al litio (LiFePO4) per il camper: come calcolare i consumi, differenze tra Ultimatron ed ExtraPOWER, prezzi aggiornati, spedizione e montaggio a Tivoli.',
    h1: 'Batteria al litio per camper: quanti Ah servono davvero',
    lead: 'Come calcolare l\'autonomia che ti serve, le differenze tra i modelli Ultimatron ed ExtraPOWER che vendiamo e i prezzi aggiornati.',
    body: `      <p>Passare al litio (LiFePO4) significa avere più energia utilizzabile e meno peso rispetto alle batterie tradizionali. La domanda giusta non è «quanti Ah costa quanto», ma <strong>«quanta energia consumo in una giornata»</strong>. Qui trovi un metodo semplice e i modelli che abbiamo a catalogo, con prezzi letti in tempo reale.</p>

      <h2>Ah e Wh: come passare dall'uno all'altro</h2>
      <p>La capacità di una batteria si indica in Ah, ma l'energia vera si misura in Wh: <strong>Wh = Volt × Ah</strong>. Una batteria da 12,8 V e 100 Ah contiene 1.280 Wh; da 200 Ah ne contiene 2.560. Per questo due batterie con gli stessi Ah ma tensione diversa non sono equivalenti.</p>

      <h2>Come calcolare quanto ti serve</h2>
      <ol>
        <li><strong>Elenca i dispositivi</strong> che userai senza collegarti alla rete (frigorifero, luci, pompa, ricarica telefoni, TV...).</li>
        <li><strong>Per ognuno scrivi la potenza (W) e le ore al giorno</strong> in cui è acceso: W × ore = Wh al giorno.</li>
        <li><strong>Somma tutto</strong> e moltiplica per i giorni di autonomia che vuoi senza ricaricare.</li>
        <li><strong>Aggiungi un margine</strong>: non conviene scaricare la batteria fino all'ultimo punto, e i consumi reali superano quasi sempre le stime.</li>
      </ol>
      <p><em>Esempio, solo per capire il metodo:</em> se in una giornata consumi 800 Wh e vuoi due giorni senza ricarica, ti servono almeno 1.600 Wh, quindi con margine una batteria da 200 Ah a 12,8 V (2.560 Wh) è la scelta sensata. Con i tuoi dispositivi i numeri saranno diversi: se vuoi, li calcoliamo insieme.</p>

      <h2>I modelli a confronto</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Capacità</th><th>Energia</th><th>Caratteristiche</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(rows)}
          </tbody>
        </table>
      </div>
      <p>Prezzi IVA inclusa. «—» significa che nella scheda non è indicato il dato in Wh: la formula sopra ti permette comunque di calcolarlo se conosci la tensione.</p>

      <h2>Ultimatron o ExtraPOWER?</h2>
      <ul>
        <li><strong>Ultimatron UBL "PRO"</strong>: BMS intelligente integrato e monitoraggio via Bluetooth dall'app; le versioni con riscaldatore permettono la ricarica fino a −35 °C. Il costruttore dichiara oltre 6.000 cicli all'80% di profondità di scarica.</li>
        <li><strong>Ultimatron ULM</strong>: custodia metallica pensata anche per il montaggio sotto il sedile del camper, con spedizione già inclusa nel prezzo.</li>
        <li><strong>ExtraPOWER LiFePO4</strong>: da 100 a 450 Ah, batterie LiFePO4 in tante taglie, per scegliere la capacità che ti serve.</li>
      </ul>
      <p>Per le caratteristiche tecniche complete di ogni modello apri la scheda prodotto dalla tabella.</p>

      <div class="guide-note"><strong>Prima di ordinare</strong> controlla lo spazio disponibile e come verrà ricaricata la batteria (alternatore, pannello solare, caricabatterie). Chiamaci al <a href="tel:+393489905455">348 990 5455</a> e ne parliamo.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello in base a peso e dimensioni (inclusa nel prezzo per la serie Ultimatron ULM, gratuita sopra 1.500 €).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per le batterie acquistate da noi: collegamento all'impianto e collaudo. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
        <dt>Quanti Ah mi servono?</dt>
        <dd>Dipende dai tuoi consumi giornalieri e dai giorni di autonomia che vuoi: usa il metodo qui sopra, oppure chiamaci e lo facciamo insieme.</dd>
        <dt>Che differenza c'è tra Ah e Wh?</dt>
        <dd>Gli Ah misurano la carica, i Wh l'energia: Wh = Volt × Ah. Per confrontare due batterie conviene guardare i Wh.</dd>
        <dt>Le batterie con riscaldatore a cosa servono?</dt>
        <dd>Le lamine riscaldanti integrate permettono di ricaricare la batteria anche con temperature molto rigide, fino a −35 °C secondo la scheda del costruttore.</dd>
        <dt>Posso ritirarla di persona?</dt>
        <dd>Sì: scegli "Ritiro in officina" nel carrello, è gratuito.</dd>
      </dl>

      <div class="guide-links">
        <a href="categoria-energia-batterie.html" class="btn btn-primary btn-sm">Vedi tutte le batterie</a>
        <a href="guida-climatizzatore-camper.html" class="btn btn-outline btn-sm">Guida al climatizzatore</a>
      </div>`
  };
}

async function main() {
  const shell = siteShell();
  const [dometic, batterie] = await Promise.all([
    fetchProducts('name=ilike.*fresh*'),
    fetchProducts('name=ilike.batteria*')
  ]);

  const guides = [buildClimateGuide(dometic), buildBatteryGuide(batterie)];
  guides.forEach((g) => {
    fs.writeFileSync(path.join(ROOT, g.file), pageHtml(shell, g), 'utf8');
    console.log('Generata', g.file);
  });

  // sitemap: rimuove le vecchie voci guida-* e le riaggiunge
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/cda-camper\.it\/guida-[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  const entries = guides.map((g) => `  <url>\n    <loc>${SITE_URL}/${g.file}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
  sitemap = sitemap.replace('</urlset>', entries.join('\n') + '\n</urlset>\n');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  console.log('sitemap.xml aggiornata con le guide.');
}

main().catch((err) => { console.error(err); process.exit(1); });
