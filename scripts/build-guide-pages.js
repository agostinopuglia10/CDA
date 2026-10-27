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
// Stesse soglie di create-checkout-session / js/main.js: spedizione gratuita da 150 € per i colli normali
// (decisione del 24/10/2026), da 1.500 € per pallet e collo lungo.
const FREE_SHIPPING_THRESHOLD_CENTS = 150000;
const FREE_SHIPPING_NORMAL_THRESHOLD_CENTS = 15000;
function freeShippingFor(p) {
  return p.price_cents >= ((p.ships_on_pallet || p.long_package) ? FREE_SHIPPING_THRESHOLD_CENTS : FREE_SHIPPING_NORMAL_THRESHOLD_CENTS);
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (cents) => (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

async function fetchProducts(nameFilter) {
  const url = SUPABASE_URL + '/rest/v1/products?select=id,image_url,name,slug,brand,price_cents,shipping_included,ships_on_pallet,long_package,weight_kg,description'
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
</script>${g.faq ? '\n<script type="application/ld+json">\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map((f) => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) }) + '\n</script>' : ''}
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
  if (freeShippingFor(p)) return 'Spedizione gratuita';
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
  const allFree = list.every(freeShippingFor);
  return {
    file: 'guida-climatizzatore-camper.html',
    shortTitle: 'Guida al climatizzatore per camper',
    title: 'Climatizzatore per camper Dometic: come scegliere | CDA Tivoli',
    description: 'Guida al climatizzatore da tetto Dometic per camper: FreshJet 1500, 1700 e 2200 W, Freshlight e Freshwell, prezzi aggiornati e installazione a Tivoli.',
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
        <li><strong>Spedizione in tutta Italia:</strong> ${allFree ? 'i climatizzatori a catalogo superano la soglia per la spedizione gratuita, quindi la spedizione è gratuita.' : 'gratuita da 150 € per i colli standard (da 1.500 € per pallet e colli lunghi), altrimenti calcolata nel carrello.'}</li>
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
        <a href="guida-riscaldamento-camper.html" class="btn btn-outline btn-sm">Guida al riscaldamento</a>
      </div>`
  };
}

// ---------- Guida 2: batterie al litio ----------
function batteryNote(p) {
  const bits = [];
  if (/Ultimatron/i.test(p.brand || p.name)) {
    if (/bluetooth/i.test(p.description || '')) bits.push('BMS intelligente e Bluetooth');
    // Il riscaldamento delle celle si legge dalla scheda (descrizione), non dal nome: anche le ULM 200H e 310H
    // hanno la pellicola riscaldante da 80 W, pur senza "Riscaldatore" nel nome.
    if (/riscaldant/i.test(p.description || '') || /Riscaldatore/i.test(p.name)) bits.push('riscaldamento delle celle: ricarica fino a −35 °C');
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
    description: 'Come scegliere la batteria al litio LiFePO4 per il camper: consumi, differenze tra Ultimatron ed ExtraPOWER, prezzi aggiornati e montaggio a Tivoli.',
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
        <li><strong>Ultimatron UBL "PRO"</strong>: BMS intelligente integrato e monitoraggio via Bluetooth dall'app; le versioni con riscaldamento delle celle permettono la ricarica fino a −35 °C. Il costruttore dichiara oltre 6.000 cicli all'80% di profondità di scarica.</li>
        <li><strong>Ultimatron ULM</strong>: custodia metallica pensata anche per il montaggio sotto il sedile del camper, con spedizione già inclusa nel prezzo. I modelli ULM-12-200H e ULM-12-310H hanno anche una pellicola riscaldante da 80 W per la ricarica fino a −35 °C.</li>
        <li><strong>ExtraPOWER LiFePO4</strong>: da 100 a 450 Ah, batterie LiFePO4 in tante taglie, per scegliere la capacità che ti serve.</li>
      </ul>
      <p>Per le caratteristiche tecniche complete di ogni modello apri la scheda prodotto dalla tabella.</p>

      <div class="guide-note"><strong>Prima di ordinare</strong> controlla lo spazio disponibile e come verrà ricaricata la batteria (alternatore, pannello solare, caricabatterie). Chiamaci al <a href="tel:+393489905455">348 990 5455</a> e ne parliamo.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello in base a peso e dimensioni (inclusa nel prezzo per la serie Ultimatron ULM, gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
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
        <a href="guida-batteria-200ah-ultimatron-extrapower.html" class="btn btn-outline btn-sm">Confronto batterie da 200 Ah</a>
        <a href="guida-kit-litio-620ah-promozione.html" class="btn btn-outline btn-sm">Kit litio 620 Ah in promozione</a>
        <a href="guida-fotovoltaico-camper.html" class="btn btn-outline btn-sm">Fotovoltaico per camper</a>
        <a href="guida-climatizzatore-camper.html" class="btn btn-outline btn-sm">Guida al climatizzatore</a>
      </div>`
  };
}

// ---------- Guida 3: riscaldatori (gasolio, gas, portatile) ----------
function heaterKind(p) {
  if (/Travel Box/i.test(p.name)) return 'portatile';
  if (/Truma/i.test(p.name)) return 'gas';
  if (/Autoterm|Riscaldatore a gasolio|Kit Riscaldamento Invernale/i.test(p.name)) return 'gasolio';
  return null;
}

function heaterPanel(p) {
  if (/PU-5/i.test(p.name)) return 'PU-5 (analogico, base)';
  if (/Comfort/i.test(p.name)) return 'Comfort (digitale, display OLED, timer programmabili)';
  return 'Non incluso: da aggiungere';
}

function heaterNote(p) {
  if (/Kit Riscaldamento Invernale/i.test(p.name)) return 'Riscaldatore Air 2D + oscurante termico per la cabina; il pannello di controllo va aggiunto';
  if (/^Kit Autoterm/i.test(p.name)) return 'Kit con tutto il necessario per l\'installazione';
  if (/Autoterm Air 2D/i.test(p.name)) return 'Motore brushless silenzioso, funzionamento garantito fino a −45 °C';
  if (/Autoterm Air 4D/i.test(p.name)) return 'Più potenza per ambienti più grandi, funzionamento garantito fino a −45 °C';
  if (/Riscaldatore a gasolio 2 kW/i.test(p.name)) return 'Compatto, per furgonati e camper di dimensioni contenute';
  if (/Riscaldatore a gasolio 4 kW/i.test(p.name)) return 'Più potenza: scalda rapidamente anche gli ambienti più grandi';
  return '';
}

function buildHeatingGuide(products) {
  const heaters = products.filter((p) => heaterKind(p) === 'gasolio');
  const gas = products.filter((p) => heaterKind(p) === 'gas');
  const portable = products.filter((p) => heaterKind(p) === 'portatile');
  if (heaters.length === 0 || gas.length === 0 || portable.length === 0) {
    throw new Error('Guida riscaldatori: manca una famiglia di prodotti nel catalogo (gasolio/gas/portatile)');
  }

  const dieselRows = heaters.map((p) => [
    `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`,
    esc(heaterPanel(p)),
    esc(heaterNote(p)),
    eur(p.price_cents),
    esc(shippingNote(p))
  ]);
  const gasRows = gas.map((p) => [
    `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`,
    /5004/.test(p.name)
      ? 'Potenza termica 6.000 W, per i camper più grandi. GPL a 30 mbar, venduta senza pannello'
      : 'Potenza termica 3.500 W, calore immediato e costante. GPL a 30 mbar, venduta senza pannello',
    eur(p.price_cents),
    esc(shippingNote(p))
  ]);
  const portableRows = portable.map((p) => [
    `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`,
    'Portatile a gasolio, 12 V, potenza di riscaldamento 2 kW: non richiede installazione fissa, pronto all\'uso in pochi minuti',
    eur(p.price_cents),
    esc(shippingNote(p))
  ]);
  // Parte alta della pagina (arrivo dai post social): numero-gancio, foto e tre schede con pulsante carrello.
  const pick = (list, re) => list.find((p) => re.test(p.slug)) || list[0];
  const kit = pick(heaters, /^kit-autoterm-air-2d-pu5/);
  const truma = pick(gas, /3004/);
  const travel = pick(portable, /travel-box/);
  const cartBtn = (p) => '<button class="add-btn add-btn-lg" data-product-id="' + esc(p.id) + '" data-product-name="' + esc(p.name) + '" data-product-price="' + p.price_cents + '" data-product-image="' + esc(p.image_url || '') + '" aria-label="Aggiungi al carrello: ' + esc(p.name) + '">Aggiungi al carrello</button>';
  const card = (p, tag, forWho, bullets) => '<div class="guide-card">'
    + '<span class="guide-card-tag">' + tag + '</span>'
    + '<a href="prodotto-' + esc(p.slug) + '.html"><img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy"></a>'
    + '<h3>' + forWho + '</h3>'
    + '<ul>' + bullets.map((b) => '<li>' + b + '</li>').join('') + '</ul>'
    + '<div class="guide-card-name"><a href="prodotto-' + esc(p.slug) + '.html">' + esc(p.name) + '</a></div>'
    + '<div class="guide-card-price">' + eur(p.price_cents) + (freeShippingFor(p) ? ' <small>· spedizione gratuita</small>' : '') + '</div>'
    + cartBtn(p) + '</div>';
  const heroHtml = '<div class="guide-hero">'
    + '<div class="guide-hero-text"><span class="guide-hero-eyebrow">Inverno in camper</span>'
    + '<div class="guide-hero-big">1-2 litri</div>'
    + '<p class="guide-hero-sub">di gasolio per scaldare il camper <strong>tutta la notte</strong>.</p>'
    + '<p class="guide-hero-note">Autoterm Air 2D: da 0,10 a 0,24 litri all\'ora a seconda della potenza impostata, quindi circa 1-2 litri in 8 ore.</p>'
    + '<a href="#scegli" class="btn guide-hero-cta">Scegli il tuo sistema</a></div>'
    + '<img class="guide-hero-img" src="' + esc(kit.image_url) + '" alt="' + esc(kit.name) + '"></div>'
    + '<h2 id="scegli">Scegli il tuo sistema</h2>'
    + '<div class="guide-cards">'
    + card(kit, 'Gasolio', 'Per chi viaggia in inverno', ['Fisso, silenzioso e indipendente dal gas', 'Funziona fino a −45 °C', 'Kit completo con pannello PU-5'])
    + card(truma, 'Gas', 'Per chi ha già il gas', ['Calore subito, accensione automatica', 'Potenza termica 3.500 W', 'Funziona a GPL, venduta senza pannello'])
    + card(travel, 'Portatile', 'Per chi non vuole installare', ['Nessuna installazione fissa', 'Pronto all\'uso in pochi minuti', 'Portatile a gasolio, 12 V, 2 kW'])
    + '</div>'
    + '<p class="guide-cards-note">Montaggio nella nostra officina di Tivoli per i prodotti acquistati da noi. Reso entro 14 giorni.</p>';
  const rowsHtml = (rows, valueCol) => rows.map((r) => `<tr>${r.map((c, i) => `<td${i === r.length - 2 ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('\n');

  return {
    file: 'guida-riscaldamento-camper.html',
    shortTitle: 'Guida al riscaldamento per camper',
    title: 'Riscaldamento a gasolio per camper: consumi e prezzi | CDA',
    description: 'Riscaldamento camper a gasolio o a gas: Autoterm Air 2D e 4D, stufe Truma (Trumatic) S 3004 e 5004, consumi per notte, pannelli e prezzi aggiornati.',
    h1: 'Riscaldamento per camper: a gasolio, a gas o portatile?',
    lead: 'Le tre soluzioni che vendiamo, a confronto, con i prezzi aggiornati e le cose da controllare prima di ordinare (compreso il pannello di controllo).',
    body: heroHtml + `
      <p>Con l'arrivo del freddo, scaldare il camper diventa la priorità. Le soluzioni che teniamo a catalogo sono tre: il <strong>riscaldatore a gasolio indipendente</strong> (Autoterm), la <strong>stufa a gas</strong> (Truma) e il <strong>riscaldatore portatile</strong> (Travel Box). Qui trovi come si differenziano. I prezzi sono letti dal nostro catalogo e si aggiornano da soli.</p>

      <h2>Riscaldatore a gasolio indipendente</h2>
      <p>Un riscaldatore a gasolio funziona in modo indipendente e si installa in modo fisso nel camper. I modelli Autoterm hanno un motore brushless silenzioso e il funzionamento è garantito fino a −45 °C. La scelta è tra <strong>Air 2D</strong> (soluzione compatta) e <strong>Air 4D</strong> (più potenza per ambienti più grandi).</p>
      <div class="guide-note"><strong>Attenzione al pannello di controllo.</strong> Per accendere e regolare il riscaldatore serve un pannello. Nei modelli che lo riportano nel nome è incluso: <strong>PU-5</strong> (pannello analogico di base) oppure <strong>Comfort</strong> (pannello digitale con display OLED e timer programmabili). I riscaldatori a gasolio da 2 kW e 4 kW senza pannello e il Kit Riscaldamento Invernale <strong>non lo includono</strong>: va aggiunto a parte.</div>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Pannello</th><th>Note</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${rowsHtml(dieselRows)}
          </tbody>
        </table>
      </div>

      <h2>Stufa a gas</h2>
      <p>La stufa a gas Truma S è la soluzione per chi preferisce il gas del camper: calore immediato e costante, con accensione automatica.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Per chi</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${rowsHtml(gasRows)}
          </tbody>
        </table>
      </div>

      <h2>Riscaldatore portatile</h2>
      <p>Se non vuoi un'installazione fissa, il <strong>Travel Box 2.0</strong> è un riscaldatore a gasolio portatile, pronto all'uso in pochi minuti.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Caratteristiche</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${rowsHtml(portableRows)}
          </tbody>
        </table>
      </div>

      <h2>Quanto consuma il riscaldamento del camper</h2>
      <p>Dati delle schede tecniche dei modelli a catalogo, con il conto per una notte di 8 ore di funzionamento continuo. Nella pratica il riscaldatore alterna potenza alta e bassa, quindi il consumo reale sta tra i due valori.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Consumo combustibile</th><th>In 8 ore</th><th>Corrente a regime</th></tr></thead>
          <tbody>
<tr><td>Autoterm Air 2D (0,8-2 kW)</td><td>0,10-0,24 l/h di gasolio</td><td>0,8-1,9 litri</td><td>10-29 W</td></tr>
<tr><td>Autoterm Air 4D (1-4 kW)</td><td>0,12-0,51 l/h di gasolio</td><td>1-4,1 litri</td><td>10-57 W</td></tr>
<tr><td>Truma S 3004 (3,5 kW)</td><td>30-280 g/h di GPL</td><td>0,24-2,2 kg</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <p>Il riscaldatore a gasolio prende il combustibile dal serbatoio del veicolo e la corrente dalla batteria dei servizi: con l'Air 2D al massimo, 8 ore sono circa 19 Ah a 12 V. Per notti lunghe al freddo conviene una batteria al litio adeguata (vedi la <a href="guida-batteria-litio-camper.html">guida alle batterie al litio</a>).</p>

      <h2>Come scegliere</h2>
      <ul>
        <li><strong>Dimensioni del camper.</strong> Per furgonati e camper di dimensioni contenute è pensata la soluzione compatta (Air 2D o il riscaldatore a gasolio da 2 kW); per ambienti più grandi guarda l'Air 4D, il 4 kW o la Truma S 5004.</li>
        <li><strong>Gasolio o gas?</strong> Il riscaldatore a gasolio funziona in modo indipendente; la stufa a gas usa l'impianto gas del camper. Scegli in base a quale combustibile preferisci avere a bordo.</li>
        <li><strong>Fisso o portatile?</strong> Il riscaldatore fisso va installato nel camper; il Travel Box si sposta dove serve e non richiede installazione fissa.</li>
        <li><strong>Pannello di controllo.</strong> Controlla sempre se è incluso (vedi riquadro sopra).</li>
      </ul>

      <div class="guide-note"><strong>Dubbi su quale scegliere o sull'installazione?</strong> Chiamaci al <a href="tel:+393489905455">348 990 5455</a> e ne parliamo prima che tu ordini.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello (gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi. Un riscaldatore fisso richiede collegamenti al combustibile e allo scarico: va fatto a regola d'arte. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
        <dt>Il pannello di controllo è incluso?</dt>
        <dd>Dipende dal modello: è incluso dove il nome riporta PU-5 o Comfort. Nei riscaldatori da 2 kW e 4 kW senza pannello e nel Kit Riscaldamento Invernale va aggiunto a parte.</dd>
        <dt>Che differenza c'è tra il pannello PU-5 e il Comfort?</dt>
        <dd>Il PU-5 è il pannello analogico di base; il Comfort è digitale, con display OLED e timer programmabili.</dd>
        <dt>Quanto gasolio consuma un riscaldatore per camper in una notte?</dt>
        <dd>L'Autoterm Air 2D consuma da 0,10 a 0,24 litri l'ora: in 8 ore da 0,8 a 1,9 litri. L'Air 4D da 0,12 a 0,51 litri l'ora.</dd>
        <dt>Fino a quale temperatura funzionano i riscaldatori Autoterm?</dt>
        <dd>Secondo la scheda, il funzionamento è garantito fino a −45 °C.</dd>
        <dt>Lo montate voi?</dt>
        <dd>Sì, se lo acquisti da noi, nel nostro centro tecnico a Tivoli (Strada Arci n.24).</dd>
      </dl>

      <div class="guide-links">
        <a href="categoria-clima-riscaldatori-gasolio-gas.html" class="btn btn-primary btn-sm">Vedi tutti i riscaldatori</a>
        <a href="guida-climatizzatore-camper.html" class="btn btn-outline btn-sm">Guida al climatizzatore</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
        <a href="guida-pannello-pu5-o-comfort-autoterm.html" class="btn btn-outline btn-sm">Autoterm: PU-5 o Comfort</a>
        <a href="guida-stufa-truma-s-3004-o-5004.html" class="btn btn-outline btn-sm">Truma S 3004 o 5004</a>
      </div>`
  };
}

// ---------- Guida 4: impianto acqua (pompe e serbatoi) ----------
function buildWaterGuide(products) {
  const pumps = products.filter((p) => /^Pompa/i.test(p.name) && !/\(blister\)/i.test(p.name));
  const tanks = products.filter((p) => /^Serbatoio/i.test(p.name));
  if (pumps.length === 0 || tanks.length === 0) throw new Error('Guida acqua: mancano pompe o serbatoi nel catalogo');
  const flow = (p) => Number((p.name.match(/(\d+)\s?L\/min/i) || [])[1] || (p.name.match(/(\d+)\s?L\b/) || [])[1] || 0);
  pumps.sort((a, b) => flow(a) - flow(b) || a.price_cents - b.price_cents);
  const pumpNote = (p) => {
    if (/Twin/i.test(p.name)) return 'Doppia pompa: portata raddoppiata per impianti con richiesta d\'acqua più elevata';
    if (/Power Jet/i.test(p.name)) return 'Alta pressione, pensata per la doccia con getto potente';
    const bits = [];
    if (/portagomma/i.test(p.name)) bits.push('attacco portagomma per collegare i tubi flessibili');
    if (/senza valvola/i.test(p.name)) bits.push('senza valvola di non ritorno');
    else if (/valvola/i.test(p.name)) bits.push('valvola di non ritorno: pressione costante, senza riflussi');
    return bits.join('; ');
  };
  const pumpRows = pumps.map((p) => [
    `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`,
    flow(p) ? flow(p) + ' L/min' : '—',
    esc(pumpNote(p)),
    eur(p.price_cents),
    esc(shippingNote(p))
  ]);
  const litres = (p) => Number((p.name.match(/(\d+)\s?L\b/) || [])[1] || 0);
  tanks.sort((a, b) => litres(a) - litres(b));
  const tankRows = tanks.map((p) => {
    const dim = (p.name.match(/\(([^)]+)\)/) || [])[1] || '—';
    return [
      `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name.replace(/\s*\([^)]*\)/, ''))}</a>`,
      litres(p) ? litres(p) + ' L' : '—',
      esc(dim),
      p.weight_kg ? esc(String(p.weight_kg).replace('.', ',')) + ' kg' : '—',
      eur(p.price_cents),
      esc(shippingNote(p))
    ];
  });
  return {
    file: 'guida-impianto-acqua-camper.html',
    shortTitle: 'Guida all\'impianto acqua del camper',
    title: 'Pompe e serbatoi acqua per camper: come scegliere | CDA Tivoli',
    description: 'Come scegliere pompa ad immersione e serbatoio acqua per il camper: portata in L/min, valvola di non ritorno, pompa Twin, capacità e prezzi aggiornati.',
    h1: 'Pompe e serbatoi acqua per camper: come scegliere',
    lead: 'Le differenze tra le pompe ad immersione e i serbatoi che vendiamo, con portate, dimensioni e prezzi aggiornati.',
    body: `      <p>L'impianto acqua di un camper si regge su due componenti: la <strong>pompa</strong>, che manda l'acqua ai rubinetti, e il <strong>serbatoio</strong>, che ne determina l'autonomia. Qui trovi i modelli che abbiamo a catalogo e le cose da guardare prima di sceglierli. I prezzi si aggiornano da soli.</p>

      <h2>Pompe ad immersione</h2>
      <p>Ogni pompa ha una <strong>portata in L/min</strong>: più è alta, più acqua arriva ai rubinetti, e più utenze possono restare aperte insieme. Due dettagli cambiano molto la scelta:</p>
      <ul>
        <li><strong>Valvola di non ritorno:</strong> nei modelli che ce l'hanno mantiene la pressione costante, senza riflussi indesiderati nel circuito.</li>
        <li><strong>Attacco portagomma:</strong> collegamento rapido ai tubi flessibili dell'impianto.</li>
        <li><strong>Twin:</strong> è una doppia pompa, con portata raddoppiata per impianti che chiedono più acqua.</li>
        <li><strong>Power Jet:</strong> versione ad alta pressione, pensata per la doccia con getto potente.</li>
      </ul>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Portata</th><th>Caratteristiche</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(pumpRows)}
          </tbody>
        </table>
      </div>
      <p>Alcuni modelli sono disponibili anche in confezione blister: li trovi nello shop con la dicitura "confezione blister".</p>

      <h2>Serbatoi acqua</h2>
      <p>La capacità dà autonomia, ma conta quanto spazio hai: i serbatoi sono pensati per entrare nei vani del camper, per questo ti diamo le dimensioni esatte.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Capacità</th><th>Dimensioni (cm)</th><th>Peso</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(tankRows)}
          </tbody>
        </table>
      </div>

      <h2>Come scegliere</h2>
      <ul>
        <li><strong>Misura lo spazio prima di tutto:</strong> controlla le dimensioni del vano e confrontale con la tabella.</li>
        <li><strong>Quante utenze usi insieme?</strong> Con più rubinetti aperti serve più portata; per un impianto semplice bastano le portate più basse.</li>
        <li><strong>Valvola di non ritorno</strong> se vuoi pressione costante e nessun riflusso.</li>
        <li><strong>Autonomia:</strong> un serbatoio più grande significa meno rifornimenti, ma anche più peso a bordo.</li>
      </ul>

      <div class="guide-note"><strong>Non sai quale pompa o serbatoio si adatta al tuo impianto?</strong> Chiamaci al <a href="tel:+393489905455">348 990 5455</a> e ti consigliamo prima che tu ordini.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello.</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <div class="guide-links">
        <a href="categoria-acqua-pompe.html" class="btn btn-primary btn-sm">Vedi tutte le pompe</a>
        <a href="categoria-acqua-serbatoi.html" class="btn btn-outline btn-sm">Vedi tutti i serbatoi</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
      </div>`
  };
}

// ---------- Guida 5: impianto elettrico (inverter, MPPT, caricabatterie) ----------
function buildPowerGuide(products) {
  const chargers = products.filter((p) => /^Carica Batterie/i.test(p.name));
  const mppt = products.filter((p) => /^Regolatore/i.test(p.name));
  const inverters = products.filter((p) => /^Inverter/i.test(p.name));
  if (chargers.length === 0 || mppt.length === 0 || inverters.length === 0) throw new Error('Guida elettrico: mancano caricabatterie, regolatori o inverter nel catalogo');
  const row = (p, mid) => [`<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`, esc(mid), eur(p.price_cents), esc(shippingNote(p))];
  const chargerRows = chargers.map((p) => row(p, /26A/.test(p.name) ? 'Batterie da 25 a 500 Ah, incluse LiFePO4' : 'Batterie da 4 a 240 Ah, incluse LiFePO4'));
  const mpptRows = mppt.map((p) => row(p, /Victron/i.test(p.name) ? 'Impianti solari 12-24 V: 30 A di carica, fino a 100 V dal pannello' : 'Impianti solari 12-24 V, con display LCD per monitorare la ricarica'));
  const invRows = inverters.map((p) => {
    const input = (p.name.match(/\b(12|24|48)V\b/) || [])[1] || (/Onda Sinusoidale/i.test(p.name) ? '12' : '');
    const mid = /by-pass/i.test(p.name) ? 'Ingresso 12 V, onda sinusoidale pura da 3000 W (picco 5900 W), con by-pass sulla rete esterna a 230 V'
      : (/Onda Sinusoidale/i.test(p.name)) ? 'Ingresso 12 V, uscita 220 V, onda sinusoidale pura: per dispositivi sensibili'
      : 'Ingresso ' + input + ' V con regolatore MPPT integrato' + ((p.name.match(/MPPT (\d+)A/) || [])[1] ? ' da ' + (p.name.match(/MPPT (\d+)A/) || [])[1] + ' A' : '');
    return row(p, mid);
  });
  return {
    file: 'guida-impianto-elettrico-camper.html',
    shortTitle: 'Guida all\'impianto elettrico del camper',
    title: 'Inverter, MPPT e caricabatterie per camper: guida | CDA Tivoli',
    description: 'Come scegliere inverter, regolatore MPPT e caricabatterie per il camper: tensioni 12, 24 e 48 V, onda sinusoidale pura, prezzi aggiornati.',
    h1: 'Inverter, regolatore MPPT e caricabatterie per camper',
    lead: 'Che cosa fa ogni componente dell\'impianto elettrico, come abbinarli e quali modelli abbiamo a catalogo, con prezzi aggiornati.',
    body: `      <p>Per avere corrente a bordo senza dipendere dalla rete servono tre pezzi che lavorano insieme: un <strong>caricabatterie</strong> (da rete o generatore), un <strong>regolatore di carica MPPT</strong> (dal pannello solare) e un <strong>inverter</strong> (che trasforma la corrente della batteria in corrente di rete a 220-230 V). Qui trovi i modelli che teniamo a catalogo e come sceglierli. I prezzi si aggiornano da soli.</p>

      <h2>La regola da non dimenticare: la tensione</h2>
      <p>Batterie, inverter e regolatori devono parlare la <strong>stessa tensione</strong>: 12, 24 o 48 V. Nei nostri modelli, gli inverter a onda sinusoidale pura da 1500 e da 3000 W hanno ingresso a 12 V, gli inverter da 2,4 e 3,5 kW a 24 V, il 5,5 kW a 48 V. Scegli prima la tensione del tuo impianto, poi il modello.</p>

      <h2>Caricabatterie</h2>
      <p>I caricabatterie switching sono automatici, compatibili 12/24 V e adatti anche alle batterie al litio LiFePO4. Cambia il range di capacità delle batterie che possono caricare.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Per chi</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(chargerRows)}
          </tbody>
        </table>
      </div>

      <h2>Regolatore di carica MPPT</h2>
      <p>Il regolatore MPPT gestisce la ricarica dal pannello solare e si adatta alla produzione, per sfruttare meglio il sole. A catalogo abbiamo il Victron BlueSolar 100/30 e un Alcapower da 40 A con display LCD per controllare la ricarica.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Per chi</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(mpptRows)}
          </tbody>
        </table>
      </div>

      <h2>Inverter</h2>
      <p>L'inverter alimenta le prese di casa (220-230 V) partendo dalla batteria. L'<strong>onda sinusoidale pura</strong> è la scelta per i dispositivi più sensibili. Gli inverter più grandi integrano già un regolatore MPPT: un pezzo in meno da installare per impianti solari più impegnativi.</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Caratteristiche</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(invRows)}
          </tbody>
        </table>
      </div>

      <h2>Come scegliere</h2>
      <ul>
        <li><strong>Parti dai consumi.</strong> Somma la potenza dei dispositivi che userai insieme: l'inverter deve reggerla, con un po' di margine.</li>
        <li><strong>Abbina la tensione</strong> di batterie, inverter e regolatore (12, 24 o 48 V).</li>
        <li><strong>Dimensiona il caricabatterie</strong> sulla capacità della tua batteria, usando il range indicato per ogni modello.</li>
        <li><strong>Solare:</strong> se vuoi un pezzo unico, scegli un inverter con MPPT integrato; se hai già un inverter, aggiungi un regolatore MPPT a parte.</li>
      </ul>

      <div class="guide-note"><strong>Impianto da dimensionare?</strong> Dicci cosa vuoi alimentare e per quanto tempo: chiamaci al <a href="tel:+393489905455">348 990 5455</a> e lo calcoliamo insieme prima di ordinare.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello (gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi: un impianto elettrico va collegato a regola d'arte. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <div class="guide-links">
        <a href="categoria-elettronica-inverter-regolatori.html" class="btn btn-primary btn-sm">Vedi inverter e regolatori</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
        <a href="guida-kit-litio-620ah-promozione.html" class="btn btn-outline btn-sm">Kit litio 620 Ah in promozione</a>
        <a href="guida-fotovoltaico-camper.html" class="btn btn-outline btn-sm">Fotovoltaico per camper</a>
        <a href="guida-impianto-acqua-camper.html" class="btn btn-outline btn-sm">Guida all'impianto acqua</a>
        <a href="guida-regolatore-mppt-o-pwm.html" class="btn btn-outline btn-sm">MPPT o PWM</a>
      </div>`
  };
}

// ---------- Guida 6: frigoriferi a compressore ----------
// Dati tecnici dalle schede del fornitore GES (06/10/2026), abbinati al modello dal codice FRG nel nome prodotto.
const FRIDGE_SPECS = {
  FRG551: { l: '50 L (senza freezer)', dim: '402 x 485 x 670', kg: '24', cons: '0,42 Ah (5,4 Wh)' },
  FRG571: { l: '70 L (senza freezer)', dim: '460 x 460 x 820', kg: '24', cons: '0,45 Ah (5,8 Wh)' },
  FRG547: { l: '47 L (freezer 4,5 L)', dim: '380 x 510 x 530', kg: '18', cons: '1,6 Ah (20,8 Wh)' },
  FRG564: { l: '64 L (freezer 10,5 L)', dim: '419 x 450 x 820', kg: '24', cons: '1,5 Ah (18,7 Wh)' },
  FRG584: { l: '83 L (freezer 10 L)', dim: '520 x 500 x 821', kg: '27', cons: '1,2 Ah (15 Wh)' },
  FRG583: { l: '83 L (freezer 10 L), con passaruota', dim: '520 x 580 x 821', kg: '23,5', cons: '0,36 kWh' },
  FRG587: { l: '87 L (freezer 10,5 L)', dim: '419 x 485 x 976', kg: '28', cons: '1,6 Ah (20 Wh)' },
  FRG575: { l: '175 L doppia porta (frigo 137 L + freezer 38 L)', dim: '523 x 593 x 1245', kg: '39,5', cons: '1,8 Ah (22,9 Wh)' }
};

function buildFridgeGuide(products) {
  const list = products.filter((p) => /^Frigorifero/i.test(p.name));
  const known = [];
  list.forEach((p) => {
    const code = (p.name.match(/FRG\d+/) || [])[0];
    if (code && FRIDGE_SPECS[code]) known.push({ p, code, s: FRIDGE_SPECS[code] });
  });
  if (known.length === 0) throw new Error('Guida frigoriferi: nessun modello con dati tecnici trovato');
  const litres = (k) => Number((k.s.l.match(/^(\d+)/) || [])[1] || 0);
  known.sort((a, b) => litres(a) - litres(b) || a.p.price_cents - b.p.price_cents);
  const rows = known.map((k) => [
    `<a href="prodotto-${esc(k.p.slug)}.html">ExtraCOOL ${esc(k.code)}</a>`,
    esc(k.s.l),
    esc(k.s.dim) + ' mm',
    esc(k.s.kg) + ' kg',
    eur(k.p.price_cents),
    esc(shippingNote(k.p))
  ]);
  const others = list.length - known.length;
  const othersNote = others > 0
    ? ' A catalogo ci sono anche altri ' + others + ' modelli di frigorifero a compressore: aprili dalla <a href="categoria-interni-cucina.html">categoria Cucina</a> per vederne le schede.'
    : '';
  return {
    file: 'guida-frigorifero-camper.html',
    shortTitle: 'Guida al frigorifero per camper',
    title: 'Frigorifero a compressore 12V per camper: come scegliere | CDA',
    description: 'Come scegliere il frigorifero a compressore a 12 V per il camper: litri, freezer, dimensioni e peso dei modelli ExtraCOOL, prezzi aggiornati.',
    h1: 'Frigorifero a compressore per camper: come scegliere',
    lead: 'I modelli ExtraCOOL a 12 V che vendiamo, con litri, freezer, dimensioni, peso e prezzi aggiornati.',
    body: `      <p>Il frigorifero a compressore lavora a 12 V, raffredda in modo efficiente anche con temperature esterne elevate e non consuma gas né richiede areazione esterna. Qui trovi i modelli <strong>ExtraCOOL</strong> che abbiamo a catalogo, con i dati tecnici dichiarati dal costruttore. I prezzi si aggiornano da soli.</p>

      <h2>I modelli a confronto</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Capacità</th><th>Dimensioni (L x P x A)</th><th>Peso</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(rows)}
          </tbody>
        </table>
      </div>
      <p>I consumi dichiarati dal costruttore sono nella scheda di ciascun modello: apri il frigorifero che ti interessa per vederli.${othersNote}</p>

      <h2>Come scegliere</h2>
      <ul>
        <li><strong>Misura il vano prima di tutto.</strong> Confronta le dimensioni in tabella con lo spazio che hai: a parità di litri la forma cambia molto (basso e largo, oppure alto e stretto).</li>
        <li><strong>Freezer sì o no?</strong> Due modelli (50 e 70 L) sono senza freezer; gli altri hanno un freezer di dimensioni diverse; il 175 L ha doppia porta, con frigorifero e freezer separati.</li>
        <li><strong>Passaruota:</strong> il modello da 83 L con passaruota è pensato per i vani dove c'è l'ingombro del passaruota.</li>
        <li><strong>Consumi:</strong> se vivi fuori rete, controlla nella scheda il consumo del modello e confrontalo con la capacità della tua batteria: ti aiuta la <a href="guida-batteria-litio-camper.html">guida alle batterie al litio</a>.</li>
      </ul>

      <div class="guide-note"><strong>Dubbi sul modello giusto per il tuo camper?</strong> Chiamaci al <a href="tel:+393489905455">348 990 5455</a> e ne parliamo prima che tu ordini.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello (gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <div class="guide-links">
        <a href="categoria-interni-cucina.html" class="btn btn-primary btn-sm">Vedi tutti i frigoriferi</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
      </div>`
  };
}

// ---------- Pagina di confronto: batterie al litio da 200 Ah ----------
function buildBattery200Compare(products) {
  const pick = (re) => {
    const p = products.find((x) => re.test(x.name));
    if (!p) throw new Error('Confronto 200 Ah: prodotto non trovato nel catalogo: ' + re);
    return p;
  };
  const ex = pick(/ExtraPOWER 200 Ah/i);
  const ulm = pick(/ULM-12-200H/i);
  const ubl = pick(/UBL-12-200H-PRO/i);
  const kg = (p) => (p.weight_kg ? String(p.weight_kg).replace('.', ',') + ' kg' : 'non indicato');
  const diff = eur(ubl.price_cents - ulm.price_cents);
  const link = (p, label) => `<a href="prodotto-${esc(p.slug)}.html">${esc(label)}</a>`;
  const faq = [
    ['Quanti Wh sono 200 Ah?', 'A 12,8 V, 200 Ah sono 2.560 Wh (Wh = V × Ah).'],
    ['Qual è la differenza tra Ultimatron ULM e UBL-PRO?', 'Entrambe sono da 200 Ah con riscaldamento delle celle. La ULM ha una custodia in metallo ribassata (357 × 316 × 152 mm) pensata per il sottosedile e la spedizione inclusa; la UBL-PRO ha una custodia in ABS e costa ' + diff + ' in più.'],
    ['Quale batteria da 200 Ah scegliere per l\'inverno?', 'Le due Ultimatron hanno il riscaldamento delle celle e dichiarano la ricarica fino a −35 °C; la ExtraPOWER non lo ha.'],
    ['Le montate voi?', 'Sì, nel nostro centro tecnico di Tivoli, solo per le batterie acquistate da noi.']
  ];
  return {
    file: 'guida-batteria-200ah-ultimatron-extrapower.html',
    shortTitle: 'Batteria al litio 200 Ah: confronto',
    title: 'Batteria litio 200 Ah camper: Ultimatron o ExtraPOWER?',
    description: 'Confronto tra le batterie al litio da 200 Ah a catalogo: ExtraPOWER, Ultimatron ULM e UBL-PRO. Cicli, dimensioni, riscaldamento celle, prezzi aggiornati.',
    h1: 'Batteria al litio da 200 Ah per camper: Ultimatron o ExtraPOWER?',
    lead: 'Tre batterie da 12,8 V e 200 Ah (2.560 Wh) a confronto: cosa cambia davvero tra loro e per quale uso conviene ciascuna.',
    faq,
    body: `      <p><strong>In breve:</strong> a parità di capacità la ExtraPOWER costa meno (${eur(ex.price_cents)}), la Ultimatron ULM-12-200H è pensata per il montaggio sotto il sedile e ha la spedizione inclusa (${eur(ulm.price_cents)}), la Ultimatron UBL-12-200H-PRO ha le celle riscaldate in una custodia in ABS (${eur(ubl.price_cents)}). Le due Ultimatron dichiarano oltre 6.000 cicli all'80% di scarica, la ExtraPOWER oltre 4.000.</p>

      <h2>Le tre batterie a confronto</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Batterie LiFePO4 da 200 Ah a catalogo CDA, prezzi IVA inclusa (dati dalle schede dei costruttori e dal nostro catalogo, letti l'08/10/2026)</caption>
          <thead><tr><th scope="col">Caratteristica</th><th scope="col">${link(ex, 'ExtraPOWER 200 Ah')}</th><th scope="col">${link(ulm, 'Ultimatron ULM-12-200H')}</th><th scope="col">${link(ubl, 'Ultimatron UBL-12-200H-PRO')}</th></tr></thead>
          <tbody>
            <tr><th scope="row">Tensione e capacità</th><td>12,8 V · 200 Ah</td><td>12,8 V · 200 Ah</td><td>12,8 V · 200 Ah</td></tr>
            <tr><th scope="row">Energia</th><td>2.560 Wh</td><td>2.560 Wh</td><td>2.560 Wh</td></tr>
            <tr><th scope="row">Cicli dichiarati (80% di scarica)</th><td>oltre 4.000</td><td>oltre 6.000</td><td>oltre 6.000</td></tr>
            <tr><th scope="row">Monitoraggio</th><td>Bluetooth</td><td>BMS intelligente, Bluetooth 4.0</td><td>BMS intelligente, Bluetooth 4.0</td></tr>
            <tr><th scope="row">Riscaldamento celle</th><td>No</td><td>Sì, pellicola da 80 W: ricarica fino a −35 °C</td><td>Sì, lamine integrate: ricarica fino a −35 °C</td></tr>
            <tr><th scope="row">Dimensioni</th><td>350 × 287 × 187 mm</td><td>357 × 316 × 152 mm (ribassata)</td><td>non indicate</td></tr>
            <tr><th scope="row">Peso (dato a catalogo)</th><td>${kg(ex)}</td><td>${kg(ulm)}</td><td>${kg(ubl)}</td></tr>
            <tr><th scope="row">Protezione</th><td>IP54</td><td>IP62</td><td>non indicata (custodia in ABS)</td></tr>
            <tr><th scope="row">Garanzia del produttore</th><td>non indicata</td><td>5 anni</td><td>5 anni</td></tr>
            <tr><th scope="row">Prezzo</th><td>${eur(ex.price_cents)}</td><td>${eur(ulm.price_cents)}</td><td>${eur(ubl.price_cents)}</td></tr>
            <tr><th scope="row">Spedizione</th><td>${esc(shippingNote(ex))}</td><td>${esc(shippingNote(ulm))}</td><td>${esc(shippingNote(ubl))}</td></tr>
          </tbody>
        </table>
      </div>
      <p>«Non indicato» significa che il dato non compare nella scheda del costruttore: preferiamo dirlo piuttosto che stimarlo.</p>

      <h2>Quale scegliere</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Quale batteria da 200 Ah per quale uso</caption>
          <thead><tr><th scope="col">Se...</th><th scope="col">Scegli</th><th scope="col">Perché</th></tr></thead>
          <tbody>
            <tr><th scope="row">Vuoi spendere meno a parità di capacità</th><td>ExtraPOWER 200 Ah</td><td>${eur(ex.price_cents)} per 2.560 Wh; celle senza riscaldamento</td></tr>
            <tr><th scope="row">Devi montarla sotto il sedile</th><td>Ultimatron ULM-12-200H</td><td>Custodia ribassata (152 mm di altezza), riscaldamento delle celle e spedizione inclusa</td></tr>
            <tr><th scope="row">Viaggi o sosti con il freddo</th><td>Ultimatron ULM o UBL-PRO</td><td>Entrambe dichiarano la ricarica fino a −35 °C</td></tr>
            <tr><th scope="row">Vuoi la custodia in ABS</th><td>Ultimatron UBL-12-200H-PRO</td><td>Costa ${diff} in più della ULM</td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-note"><strong>Non ancora provate in officina.</strong> I dati di questa pagina sono quelli dichiarati dai costruttori: non abbiamo ancora eseguito prove sul nostro banco. Quando le faremo, i risultati verranno aggiunti qui con data e modello del veicolo.</div>

      <h2>Prima di ordinare</h2>
      <p>Controlla lo spazio disponibile (le dimensioni qui sopra sono quelle del costruttore) e come verrà ricaricata la batteria: alternatore, pannello solare o caricabatterie. Per calcolare quanta capacità ti serve, leggi la <a href="guida-batteria-litio-camper.html">guida alle batterie al litio</a>.</p>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello in base a peso e dimensioni (inclusa nel prezzo per la Ultimatron ULM, gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per le batterie acquistate da noi. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>

      <div class="guide-links">
        <a href="categoria-energia-batterie.html" class="btn btn-primary btn-sm">Vedi tutte le batterie</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
      </div>`
  };
}

// ---------- Pagina di confronto: pannello PU-5 o Comfort (riscaldatori Autoterm) ----------
function buildPanelCompare(products) {
  const find = (re) => {
    const p = products.find((x) => re.test(x.name));
    if (!p) throw new Error('Confronto pannelli: prodotto non trovato nel catalogo: ' + re);
    return p;
  };
  const a2pu = find(/^Autoterm Air 2D con pannello PU-5$/i);
  const a2co = find(/^Autoterm Air 2D con pannello Comfort$/i);
  const a4pu = find(/^Autoterm Air 4D con pannello PU-5$/i);
  const a4co = find(/^Autoterm Air 4D con pannello Comfort$/i);
  const k2pu = find(/^Kit Autoterm Air 2D con pannello PU-5$/i);
  const k2co = find(/^Kit Autoterm Air 2D con pannello Comfort$/i);
  const k4pu = find(/^Kit Autoterm Air 4D con pannello PU-5$/i);
  const k4co = find(/^Kit Autoterm Air 4D con pannello Comfort$/i);
  const link = (p, label) => `<a href="prodotto-${esc(p.slug)}.html">${esc(label || p.name)}</a>`;
  const d = (a, b) => eur(b.price_cents - a.price_cents);
  const row = (label, pu, co) => `<tr><th scope="row">${esc(label)}</th><td>${link(pu, eur(pu.price_cents))}</td><td>${link(co, eur(co.price_cents))}</td><td class="num">+ ${d(pu, co)}</td></tr>`;
  const faq = [
    ['Qual è la differenza tra il pannello PU-5 e il Comfort?', 'Secondo la scheda GES il PU-5 è un pannello analogico di base e il Comfort è un pannello digitale con display OLED. Secondo le schede dei rivenditori specializzati il Comfort ha anche tre timer programmabili e un sensore di temperatura integrato, che il PU-5 non ha. Il riscaldatore Autoterm è lo stesso: cambia solo il pannello.'],
    ['Quanto costa in più il pannello Comfort?', `Sull'Air 2D ${d(a2pu, a2co)} in più (${eur(a2pu.price_cents)} contro ${eur(a2co.price_cents)}), sull'Air 4D ${d(a4pu, a4co)} in più (${eur(a4pu.price_cents)} contro ${eur(a4co.price_cents)}). Nei kit la differenza è di ${d(k2pu, k2co)} sul 2D e ${d(k4pu, k4co)} sul 4D.`],
    ['Il pannello è incluso nel prezzo?', 'Sì, nei modelli che lo riportano nel nome (con pannello PU-5 o con pannello Comfort). I riscaldatori a gasolio da 2 kW e 4 kW senza pannello e il Kit Riscaldamento Invernale non lo includono: va aggiunto a parte.'],
    ['Montate voi il riscaldatore?', 'Sì, nel nostro centro tecnico di Tivoli, solo per i prodotti acquistati da noi.']
  ];
  return {
    file: 'guida-pannello-pu5-o-comfort-autoterm.html',
    shortTitle: 'Autoterm: pannello PU-5 o Comfort',
    title: 'Autoterm PU-5 o Comfort: quale pannello scegliere',
    description: 'Differenze tra i pannelli PU-5 e Comfort dei riscaldatori Autoterm Air 2D e 4D a catalogo: funzioni, differenza di prezzo e quale scegliere.',
    h1: 'Riscaldatore Autoterm: pannello PU-5 o Comfort?',
    lead: 'Lo stesso riscaldatore a gasolio con due pannelli di controllo diversi: cosa cambia e quanto costa in più.',
    faq,
    body: `      <p><strong>In breve:</strong> il riscaldatore Autoterm Air 2D o 4D è lo stesso con entrambi i pannelli. Il PU-5 è il pannello analogico di base; il Comfort è digitale, con display OLED e timer programmabili, e costa ${d(a2pu, a2co)} in più sull'Air 2D e ${d(a4pu, a4co)} in più sull'Air 4D.</p>

      <h2>I due pannelli a confronto</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Pannelli di controllo Autoterm a catalogo CDA (tipo di pannello dalle schede GES; timer e sensore dalle schede dei rivenditori specializzati, non dal manuale Autoterm; letti l'08/10/2026)</caption>
          <thead><tr><th scope="col">Caratteristica</th><th scope="col">PU-5</th><th scope="col">Comfort</th></tr></thead>
          <tbody>
            <tr><th scope="row">Tipo</th><td>Pannello analogico di base</td><td>Pannello digitale con display OLED</td></tr>
            <tr><th scope="row">Timer programmabili</th><td>No</td><td>Sì, fino a tre</td></tr>
            <tr><th scope="row">Sensore di temperatura nel pannello</th><td>No</td><td>Sì</td></tr>
            <tr><th scope="row">Riscaldatore</th><td>Autoterm Air 2D o 4D</td><td>Autoterm Air 2D o 4D (identico)</td></tr>
            <tr><th scope="row">Funzionamento garantito fino a</th><td>-45 °C</td><td>-45 °C</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Prezzi: stessa scelta, due pannelli</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Prezzi IVA inclusa, ultimo controllo 08/10/2026</caption>
          <thead><tr><th scope="col">Modello</th><th scope="col">Con PU-5</th><th scope="col">Con Comfort</th><th scope="col">Differenza</th></tr></thead>
          <tbody>
            ${row('Autoterm Air 2D', a2pu, a2co)}
            ${row('Autoterm Air 4D', a4pu, a4co)}
            ${row('Kit Autoterm Air 2D', k2pu, k2co)}
            ${row('Kit Autoterm Air 4D', k4pu, k4co)}
          </tbody>
        </table>
      </div>
      <p>I kit comprendono tutto il necessario per l'installazione; la scelta tra Air 2D (soluzione compatta) e Air 4D (più potenza per ambienti più grandi) la trovi nella <a href="guida-riscaldamento-camper.html">guida al riscaldamento</a>.</p>

      <h2>Quale scegliere</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Quale pannello per quale uso</caption>
          <thead><tr><th scope="col">Se...</th><th scope="col">Scegli</th><th scope="col">Perché</th></tr></thead>
          <tbody>
            <tr><th scope="row">Vuoi spendere meno</th><td>PU-5</td><td>Stesso riscaldatore, ${d(a2pu, a2co)} in meno sull'Air 2D</td></tr>
            <tr><th scope="row">Vuoi programmare l'accensione</th><td>Comfort</td><td>Ha fino a tre timer programmabili</td></tr>
            <tr><th scope="row">Vuoi un sensore di temperatura nel pannello</th><td>Comfort</td><td>Il sensore è integrato nel pannello</td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-note"><strong>Non ancora provati in officina.</strong> Le funzioni dei pannelli sono quelle indicate nelle schede GES e dei rivenditori specializzati: non abbiamo ancora eseguito confronti sul nostro banco e prima di ordinare conviene verificarle nel manuale del tuo modello. Se lo faremo, i risultati verranno aggiunti qui con data e modello.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello in base a peso e dimensioni (gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i riscaldatori acquistati da noi. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>

      <div class="guide-links">
        <a href="categoria-clima-riscaldatori-gasolio-gas.html" class="btn btn-primary btn-sm">Vedi tutti i riscaldatori</a>
        <a href="guida-riscaldamento-camper.html" class="btn btn-outline btn-sm">Guida al riscaldamento</a>
        <a href="guida-stufa-truma-s-3004-o-5004.html" class="btn btn-outline btn-sm">Truma S 3004 o 5004</a>
      </div>`
  };
}

// ---------- Pagina di confronto: stufa a gas Truma S 3004 o S 5004 ----------
function buildTrumaCompare(products) {
  const find = (re) => {
    const p = products.find((x) => re.test(x.name));
    if (!p) throw new Error('Confronto Truma: prodotto non trovato nel catalogo: ' + re);
    return p;
  };
  const s3 = find(/Truma S 3004/i);
  const s5 = find(/Truma S 5004/i);
  const kg = (p) => (p.weight_kg ? String(p.weight_kg).replace('.', ',') + ' kg' : 'non indicato');
  const link = (p, label) => `<a href="prodotto-${esc(p.slug)}.html">${esc(label)}</a>`;
  const faq = [
    ['Qual è la differenza tra la Truma S 3004 e la S 5004?', 'La potenza termica nominale: 3.500 W contro 6.000 W. La S 5004 consuma più gas (da 60 a 480 g/h contro 30-280 g/h), è più grande e pesante ed è indicata dal fornitore per i camper più grandi.'],
    ['Il pannello è incluso?', 'No: entrambe le stufe sono fornite senza pannello, come indicato dal fornitore.'],
    ['Che gas usano?', 'GPL a 30 mbar, con accensione automatica.'],
    ['Si può aggiungere un ventilatore?', 'Sì, entrambe sono predisposte per un ventilatore 012 TEB/TEN.'],
    ['Le montate voi?', 'Sì, nel nostro centro tecnico di Tivoli, solo per le stufe acquistate da noi.']
  ];
  return {
    file: 'guida-stufa-truma-s-3004-o-5004.html',
    shortTitle: 'Truma S 3004 o S 5004',
    title: 'Truma S 3004 o S 5004: quale stufa a gas scegliere',
    description: 'Confronto tra le stufe a gas Truma S 3004 e S 5004 a catalogo: potenza, consumo di gas, dimensioni, peso e prezzi aggiornati.',
    h1: 'Stufa a gas Truma: S 3004 o S 5004?',
    lead: 'Due stufe Truma a GPL con accensione automatica: cosa cambia in potenza, consumi, ingombro e prezzo.',
    faq,
    body: `      <p><strong>In breve:</strong> la Truma S 3004 ha una potenza termica nominale di 3.500 W e costa ${eur(s3.price_cents)}; la S 5004 arriva a 6.000 W, è indicata dal fornitore per i camper più grandi e costa ${eur(s5.price_cents)}. Entrambe sono a GPL a 30 mbar, con accensione automatica e senza pannello.</p>

      <h2>Le due stufe a confronto</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Stufe a gas Truma a catalogo CDA, prezzi IVA inclusa (dati dalle schede del fornitore e dal nostro catalogo, letti l'08/10/2026)</caption>
          <thead><tr><th scope="col">Caratteristica</th><th scope="col">${link(s3, 'Truma S 3004')}</th><th scope="col">${link(s5, 'Truma S 5004')}</th></tr></thead>
          <tbody>
            <tr><th scope="row">Potenza termica nominale</th><td>3.500 W</td><td>6.000 W</td></tr>
            <tr><th scope="row">Consumo di gas</th><td>da 30 a 280 g/h</td><td>da 60 a 480 g/h</td></tr>
            <tr><th scope="row">Alimentazione</th><td>GPL a 30 mbar</td><td>GPL a 30 mbar</td></tr>
            <tr><th scope="row">Accensione</th><td>Automatica</td><td>Automatica</td></tr>
            <tr><th scope="row">Dimensioni</th><td>503 × 545 × 373 mm</td><td>533 × 568 × 496 mm</td></tr>
            <tr><th scope="row">Peso (dato a catalogo)</th><td>${kg(s3)}</td><td>${kg(s5)}</td></tr>
            <tr><th scope="row">Ventilatore</th><td>Predisposta per 012 TEB/TEN</td><td>Predisposta per 012 TEB/TEN</td></tr>
            <tr><th scope="row">Pannello</th><td>Non incluso</td><td>Non incluso</td></tr>
            <tr><th scope="row">Prezzo</th><td>${eur(s3.price_cents)}</td><td>${eur(s5.price_cents)}</td></tr>
            <tr><th scope="row">Spedizione</th><td>${esc(shippingNote(s3))}</td><td>${esc(shippingNote(s5))}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Quale scegliere</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Quale stufa per quale camper</caption>
          <thead><tr><th scope="col">Se...</th><th scope="col">Scegli</th><th scope="col">Perché</th></tr></thead>
          <tbody>
            <tr><th scope="row">Il camper è di dimensioni contenute o medie</th><td>S 3004</td><td>3.500 W, ingombro e peso minori, consumo da 30 a 280 g/h</td></tr>
            <tr><th scope="row">Il camper è grande</th><td>S 5004</td><td>6.000 W, indicata dal fornitore per i camper più grandi</td></tr>
            <tr><th scope="row">Hai poco spazio per il vano stufa</th><td>S 3004</td><td>503 × 545 × 373 mm contro 533 × 568 × 496 mm</td></tr>
          </tbody>
        </table>
      </div>

      <div class="guide-note"><strong>Prima di ordinare</strong> misura il vano e controlla l'impianto del gas del tuo camper. Per scegliere la potenza giusta chiamaci al <a href="tel:+393489905455">348 990 5455</a>: ti consigliamo in base al tuo camper.</div>

      <div class="guide-note"><strong>Non ancora provate in officina.</strong> I dati di questa pagina sono quelli del fornitore: non abbiamo ancora eseguito prove sul nostro banco. Se lo faremo, i risultati verranno aggiunti qui con data e modello del veicolo.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello in base a peso e dimensioni (gratuita da 150 € per i colli standard, da 1.500 € per pallet e colli lunghi).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per le stufe acquistate da noi, con collegamento e collaudo. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>

      <div class="guide-links">
        <a href="categoria-clima-riscaldatori-gasolio-gas.html" class="btn btn-primary btn-sm">Vedi tutti i riscaldatori</a>
        <a href="guida-riscaldamento-camper.html" class="btn btn-outline btn-sm">Guida al riscaldamento</a>
        <a href="guida-pannello-pu5-o-comfort-autoterm.html" class="btn btn-outline btn-sm">Autoterm: PU-5 o Comfort</a>
      </div>`
  };
}

// ---------- Pagina di confronto: regolatore di carica MPPT o PWM ----------
function buildMpptCompare(products) {
  const mpptList = products.filter((x) => /^Regolatore di Carica MPPT/i.test(x.name)).sort((a, b) => a.price_cents - b.price_cents);
  if (mpptList.length === 0) throw new Error('Confronto MPPT/PWM: regolatore MPPT non trovato nel catalogo');
  const mpptN = mpptList.length === 1 ? 'un regolatore' : mpptList.length + ' regolatori';
  const mpptPrezzi = mpptList.map((p) => eur(p.price_cents)).join(' e ');
  const inverters = products.filter((x) => /^Inverter .*MPPT/i.test(x.name)).sort((a, b) => a.price_cents - b.price_cents);
  if (inverters.length === 0) throw new Error('Confronto MPPT/PWM: nessun inverter con MPPT nel catalogo');
  const link = (p, label) => `<a href="prodotto-${esc(p.slug)}.html">${esc(label || p.name)}</a>`;
  const invRows = inverters.map((p) => `<tr><td>${link(p)}</td><td class="num">${eur(p.price_cents)}</td><td>${esc(shippingNote(p))}</td></tr>`).join('\n            ');
  const faq = [
    ['Qual è la differenza tra regolatore MPPT e PWM?', 'Il regolatore PWM collega il pannello alla batteria adattandone la tensione a quella della batteria. L\'MPPT cerca invece il punto di lavoro migliore del pannello e converte la tensione in più in corrente di carica: di solito rende di più, soprattutto quando il pannello ha una tensione più alta di quella della batteria.'],
    ['Vendete regolatori PWM?', 'No: a catalogo abbiamo solo regolatori MPPT, compresi quelli integrati negli inverter.'],
    ['Quale regolatore MPPT avete?', `${mpptList.map((p) => 'Il ' + p.name + ' da ' + eur(p.price_cents)).join('; ')}, e ${inverters.length === 3 ? 'tre' : inverters.length} inverter con regolatore MPPT integrato.`],
    ['Come scelgo la potenza?', 'Dipende dai pannelli e dalla tensione dell\'impianto (12, 24 o 48 V). Chiamaci al 348 990 5455 con i dati dei tuoi pannelli e ti consigliamo.']
  ];
  return {
    file: 'guida-regolatore-mppt-o-pwm.html',
    shortTitle: 'Regolatore di carica: MPPT o PWM',
    title: 'MPPT o PWM: quale regolatore di carica scegliere',
    description: 'Differenza tra regolatore di carica MPPT e PWM per il camper, e i modelli MPPT a catalogo CDA: regolatori da 30 e 40 A e inverter con MPPT integrato.',
    h1: 'Regolatore di carica per il camper: MPPT o PWM?',
    lead: 'Come funzionano i due tipi di regolatore, quando conviene l\'MPPT e quali modelli MPPT abbiamo a catalogo.',
    faq,
    body: `      <p><strong>In breve:</strong> il regolatore PWM è la soluzione semplice; l'MPPT è più sofisticato e di solito sfrutta meglio i pannelli. A catalogo abbiamo solo regolatori MPPT: ${mpptN} (${mpptPrezzi}) e ${inverters.length === 3 ? 'tre' : inverters.length} inverter con MPPT integrato.</p>

      <h2>Come funzionano</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>MPPT e PWM a confronto (principi generali di funzionamento)</caption>
          <thead><tr><th scope="col">Aspetto</th><th scope="col">PWM</th><th scope="col">MPPT</th></tr></thead>
          <tbody>
            <tr><th scope="row">Come carica</th><td>Porta la tensione del pannello a quella della batteria</td><td>Cerca il punto di lavoro migliore del pannello e converte la tensione in più in corrente</td></tr>
            <tr><th scope="row">Pannello e batteria</th><td>Servono tensioni compatibili tra loro</td><td>Il pannello può avere una tensione più alta di quella della batteria</td></tr>
            <tr><th scope="row">Resa</th><td>Più semplice, rende meno</td><td>Di solito rende di più, soprattutto con pannelli ad alta tensione</td></tr>
            <tr><th scope="row">Costo</th><td>In genere più basso</td><td>In genere più alto</td></tr>
            <tr><th scope="row">A catalogo CDA</th><td>Non venduto</td><td>Sì</td></tr>
          </tbody>
        </table>
      </div>

      <h2>I modelli MPPT che vendiamo</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Regolatori MPPT a catalogo CDA, prezzi IVA inclusa, ultimo controllo 08/10/2026</caption>
          <thead><tr><th scope="col">Modello</th><th scope="col">Prezzo</th><th scope="col">Spedizione</th></tr></thead>
          <tbody>
            ${mpptList.map((m) => `<tr><td>${link(m)}</td><td class="num">${eur(m.price_cents)}</td><td>${esc(shippingNote(m))}</td></tr>`).join('\n            ')}
            ${invRows}
          </tbody>
        </table>
      </div>
      <p>I regolatori funzionano su impianti a 12-24 V (il Victron BlueSolar 100/30 fino a 30 A di carica e 100 V dal pannello, l'Alcapower fino a 40 A); gli inverter con MPPT integrato uniscono la conversione a 230 V e la ricarica dai pannelli (nomi e tensioni nella tabella). Per il resto dell'impianto leggi la <a href="guida-impianto-elettrico-camper.html">guida all'impianto elettrico</a>.</p>

      <div class="guide-note"><strong>Non ancora provati in officina.</strong> La differenza tra MPPT e PWM è quella dei principi di funzionamento generali: non abbiamo ancora misurato le rese sul nostro banco con un confronto diretto. Se lo faremo, i dati verranno aggiunti qui con data e impianto.</div>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>

      <div class="guide-links">
        <a href="categoria-elettronica-inverter-regolatori.html" class="btn btn-primary btn-sm">Vedi inverter e regolatori</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
        <a href="guida-batteria-200ah-ultimatron-extrapower.html" class="btn btn-outline btn-sm">Batterie da 200 Ah</a>
      </div>`
  };
}

// ---------- Promozione: kit batteria al litio 620 Ah ----------
// Prezzi e totali sono letti dal catalogo; il prezzo del kit e la scadenza sono quelli della promozione
// approvata da Maria (documento "PROMOZIONE PER IMPIANTO LITIO 620A"): se il catalogo cambia al punto che
// il kit non conviene piu' dei pezzi singoli, la build si ferma invece di pubblicare un risparmio falso.
const KIT620 = { supplyCents: 455000, withInstallCents: 650000, validUntil: '31 dicembre 2026' };

function buildKitLitio620(kitProducts) {
  const bySlug = {};
  kitProducts.forEach((p) => { bySlug[p.slug] = p; });
  const parts = [
    ['cda-0177-batteria-litio-ultimatron-ulm-12-620', 1, 'Batteria al litio LiFePO4 da 620 Ah a 12,8 V: 7.936 Wh di energia'],
    ['cda-0193-caricabatterie-dc-dc-victron-orion-xs-50a', 1, 'Ricarica la batteria dall\'alternatore mentre il motore è acceso (50 A)'],
    ['cda-0190-regolatore-mppt-victron-100-30', 1, 'Gestisce la ricarica dai pannelli solari (30 A, fino a 100 V dal pannello)'],
    ['cda-0191-pannello-solare-all-black-300w', 2, 'Ricarica la batteria dal sole: due pannelli da 300 W'],
    ['cda-0192-inverter-onda-pura-3000w-bypass', 1, 'Porta la corrente a 230 V a bordo: onda sinusoidale pura, 3000 W (picco 5.900 W), con by-pass sulla rete esterna'],
    ['cda-0194-caricabatterie-mestic-mbc-1040-40a', 1, 'Ricarica da rete a 230 V: 40 A, con profilo per batterie al litio']
  ];
  parts.forEach((x) => { if (!bySlug[x[0]]) throw new Error('Kit litio 620: componente non trovato nel catalogo: ' + x[0]); });
  const sum = parts.reduce((t, x) => t + bySlug[x[0]].price_cents * x[1], 0);
  const saving = sum - KIT620.supplyCents;
  if (saving <= 0) throw new Error('Kit litio 620: il prezzo del kit non e\' inferiore alla somma dei pezzi (' + eur(sum) + '): promozione non pubblicabile');
  const pct = Math.round(saving / sum * 100);
  const rows = parts.map((x) => {
    const p = bySlug[x[0]];
    return `            <tr><td><a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a></td><td>${esc(x[2])}</td><td class="num">${x[1]}</td><td class="num">${eur(p.price_cents * x[1])}</td></tr>`;
  }).join('\n');
  const faq = [
    ['Fino a quando vale la promozione?', 'Fino al ' + KIT620.validUntil + '.'],
    ['Quanto costa il kit?', 'La fornitura completa costa ' + eur(KIT620.supplyCents) + ' IVA inclusa. Con il montaggio nella nostra officina di Tivoli il totale è ' + eur(KIT620.withInstallCents) + '.'],
    ['Gli accessori di posa sono inclusi?', 'Sì, sono compresi gli accessori di posa necessari al montaggio.'],
    ['Posso comprare solo alcuni componenti?', 'Sì: ogni componente è in catalogo al prezzo indicato in tabella. Il prezzo del kit vale per l\'insieme completo.'],
    ['Quanti kWh sono 620 Ah?', 'A 12,8 V, 620 Ah sono 7.936 Wh (Wh = V × Ah), cioè circa 7,9 kWh.'],
    ['Il kit è adatto al mio camper?', 'Dipende da tensione dell\'impianto, spazio disponibile e consumi. Scrivici modello e anno del mezzo e come lo usi: ti diciamo se il kit va bene.']
  ];
  return {
    file: 'guida-kit-litio-620ah-promozione.html',
    shortTitle: 'Kit litio 620 Ah in promozione',
    title: 'Kit batteria al litio 620 Ah in promozione | CDA Tivoli',
    description: 'Impianto completo al litio da 620 Ah (7.936 Wh) con ricarica da alternatore, dal sole e da rete e inverter 3000 W: ' + eur(KIT620.supplyCents) + ' fino al 31/12/2026.',
    h1: 'Kit batteria al litio 620 Ah: impianto completo in promozione',
    lead: 'Batteria, ricarica da alternatore, solare e rete, inverter a 230 V e accessori di posa in un unico kit, fino al ' + KIT620.validUntil + '.',
    faq,
    body: `      <p><strong>In breve:</strong> impianto completo al litio da 620 Ah (7.936 Wh) a <strong>${eur(KIT620.supplyCents)}</strong> IVA inclusa. Con il montaggio nella nostra officina di Tivoli il totale è <strong>${eur(KIT620.withInstallCents)}</strong>. Promozione valida <strong>fino al ${KIT620.validUntil}</strong>. Gli accessori di posa sono inclusi.</p>

      <h2>Cosa comprende il kit</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>Componenti del kit e prezzi singoli a catalogo (IVA inclusa, letti dal catalogo CDA)</caption>
          <thead><tr><th scope="col">Componente</th><th scope="col">A cosa serve</th><th scope="col">Quantità</th><th scope="col">Prezzo singolo</th></tr></thead>
          <tbody>
${rows}
            <tr><td>Accessori di posa</td><td>Cavi e staffe per il montaggio</td><td class="num">incluso</td><td class="num">incluso</td></tr>
            <tr><th scope="row" colspan="3">Somma dei prezzi singoli a catalogo</th><td class="num">${eur(sum)}</td></tr>
            <tr><th scope="row" colspan="3">Prezzo del kit completo (fornitura)</th><td class="num"><strong>${eur(KIT620.supplyCents)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p>Rispetto ai pezzi acquistati uno a uno si risparmiano <strong>${eur(saving)}</strong> (circa il ${pct}%), con la certezza che i componenti sono compatibili tra loro. I dati tecnici dei singoli componenti sono quelli dichiarati dai costruttori.</p>

      <h2>Fornitura o fornitura più montaggio</h2>
      <ul>
        <li><strong>Solo fornitura: ${eur(KIT620.supplyCents)}.</strong> Spediamo in tutta Italia; il costo e i tempi di consegna te li confermiamo nel preventivo.</li>
        <li><strong>Fornitura e montaggio: ${eur(KIT620.withInstallCents)}.</strong> Su richiesta, il montaggio può essere eseguito presso la nostra officina di Tivoli (Strada Arci 24); in alternativa, l'installazione può essere effettuata in autonomia o da un tecnico di fiducia.</li>
      </ul>

      <h2>Per chi è</h2>
      <p>Per chi vuole stare più a lungo lontano dalle colonnine: la batteria si ricarica dall'alternatore mentre si viaggia, dal sole e dalla rete, e l'inverter porta a bordo le prese a 230 V.</p>

      <h2>Come richiederlo</h2>
      <ol>
        <li>Scrivici o chiamaci: marca, modello e anno del tuo camper e come lo usi.</li>
        <li>Ti confermiamo se il kit è adatto e il totale per il tuo caso.</li>
        <li>Se vai avanti, ordiniamo e, se lo hai scelto, fissiamo il montaggio in officina.</li>
      </ol>
      <div class="guide-links">
        <a href="contatti.html?motivo=kit-litio-620" class="btn btn-primary btn-sm">Richiedi un preventivo</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alla batteria al litio</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
      </div>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>`
  };
}

// Riquadro del kit in home: compare solo fino alla scadenza della promozione e poi si svuota da solo.
function injectHomeKitPromo() {
  const file = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const start = '<!-- KIT-LITIO-HOME:START -->';
  const end = '<!-- KIT-LITIO-HOME:END -->';
  const i = html.indexOf(start), j = html.indexOf(end);
  if (i < 0 || j < 0) { console.log('index.html: marcatori del kit non trovati, riquadro non inserito'); return false; }
  const active = new Date() <= new Date('2026-12-31T23:59:59');
  const block = active
    ? `${start}\n<div class="cta-band promo">\n  <div class="container">\n    <h2>Kit batteria al litio 620 Ah: ${eur(KIT620.supplyCents)} fino al 31 dicembre</h2>\n    <p>Batteria da 7.936 Wh, ricarica da alternatore, dal sole e da rete, inverter a 230 V e accessori di posa. Con il montaggio nella nostra officina di Tivoli: ${eur(KIT620.withInstallCents)}.</p>\n    <a href="guida-kit-litio-620ah-promozione.html" class="btn btn-outline on-dark">Cosa comprende</a>\n    <a href="contatti.html?motivo=kit-litio-620" class="btn btn-outline on-dark">Richiedi un preventivo</a>\n  </div>\n</div>\n${end}`
    : `${start}\n${end}`;
  const out = html.slice(0, i) + block + html.slice(j + end.length);
  if (out !== html) fs.writeFileSync(file, out, 'utf8');
  console.log(active ? 'Home: riquadro del kit aggiornato.' : 'Home: promozione scaduta, riquadro rimosso.');
  return true;
}

// ---------- Pagina madre: fotovoltaico per camper ----------
// Collega le guide esistenti e i componenti a catalogo. Contiene solo principi generali di dimensionamento
// (nessuna misura nostra) e dati dichiarati dai costruttori; i prezzi sono letti dal catalogo.
function buildSolarPillar(panels, regulators, batteries, inverters, chargers) {
  const link = (p) => `<a href="prodotto-${esc(p.slug)}.html">${esc(p.name)}</a>`;
  const list = (arr) => arr.length === 0 ? '<em>al momento nessun modello a catalogo</em>'
    : '<ul class="guide-hub-list">' + arr.map((p) => `<li>${link(p)}: ${eur(p.price_cents)}</li>`).join('') + '</ul>';
  const dcdc = chargers.filter((p) => /DC\/DC/i.test(p.name));
  const mains = chargers.filter((p) => !/DC\/DC/i.test(p.name));
  const kitActive = new Date() <= new Date('2026-12-31T23:59:59');
  const faq = [
    ['Quanti pannelli solari servono per un camper?', 'Dipende da quanta energia consumi ogni giorno e dal sole della zona in cui viaggi. Si parte dai consumi in Wh al giorno (potenza in W per ore di uso) e da lì si sceglie la potenza dei pannelli. Scrivici i tuoi consumi e ti aiutiamo a fare il conto.'],
    ['Meglio un regolatore MPPT o PWM?', 'Il regolatore MPPT di solito sfrutta meglio i pannelli, soprattutto quando hanno una tensione più alta di quella della batteria. Il PWM è più semplice. A catalogo abbiamo solo regolatori MPPT: il confronto è nella guida dedicata.'],
    ['Posso ricaricare la batteria mentre guido?', 'Sì, con un caricabatterie DC/DC collegato all\'alternatore, che carica la batteria di servizio con la curva giusta mentre il motore è acceso.'],
    ['Mi serve un inverter?', 'Solo se vuoi usare apparecchi a 230 V (per esempio un computer o piccoli elettrodomestici). Per i soli apparecchi a 12 V non serve.'],
    ['Montate voi l\'impianto?', 'Su richiesta, il montaggio può essere eseguito presso la nostra officina di Tivoli; in alternativa, l\'installazione può essere effettuata in autonomia o da un tecnico di fiducia. La fornitura la spediamo in tutta Italia.']
  ];
  return {
    file: 'guida-fotovoltaico-camper.html',
    shortTitle: 'Fotovoltaico per camper',
    title: 'Fotovoltaico per camper: pannelli, regolatore, batteria | CDA',
    description: 'Come funziona un impianto fotovoltaico per camper: pannelli, regolatore MPPT, batteria, inverter e ricarica da alternatore, con errori da evitare e modelli a catalogo.',
    h1: 'Fotovoltaico per camper: come funziona e come scegliere i componenti',
    lead: 'Pannelli, regolatore di carica, batteria e inverter: che cosa fa ciascun pezzo, come abbinarli e quali errori evitare.',
    faq,
    body: `      <p><strong>In breve:</strong> un impianto fotovoltaico per camper è una catena di pezzi che devono andare d'accordo: i <strong>pannelli</strong> producono corrente, il <strong>regolatore</strong> la porta alla batteria nel modo giusto, la <strong>batteria</strong> la conserva e l'<strong>inverter</strong> la trasforma in corrente a 230 V. Per ricaricare anche in viaggio e da rete si aggiungono un <strong>caricabatterie DC/DC</strong> (dall'alternatore) e un <strong>caricabatterie da rete</strong>.</p>

      <h2>Che cosa fa ogni componente</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <caption>I componenti di un impianto solare per camper e cosa guardare nella scelta</caption>
          <thead><tr><th scope="col">Componente</th><th scope="col">Che cosa fa</th><th scope="col">Cosa guardare</th><th scope="col">Approfondimento</th></tr></thead>
          <tbody>
            <tr><th scope="row">Pannello solare</th><td>Trasforma la luce in corrente</td><td>Potenza in watt (W), dimensioni e peso sul tetto, tensione</td><td><a href="guida-regolatore-mppt-o-pwm.html">MPPT o PWM</a></td></tr>
            <tr><th scope="row">Regolatore di carica</th><td>Porta la corrente dei pannelli alla batteria con la curva di carica giusta</td><td>Corrente massima in ampere (A) e tensione massima del pannello in volt (V)</td><td><a href="guida-regolatore-mppt-o-pwm.html">MPPT o PWM</a></td></tr>
            <tr><th scope="row">Batteria</th><td>Conserva l'energia</td><td>Capacità in Ah e tensione in V: Wh = V × Ah; litio o piombo</td><td><a href="guida-batteria-litio-camper.html">Batteria al litio</a>, <a href="guida-batteria-200ah-ultimatron-extrapower.html">confronto 200 Ah</a></td></tr>
            <tr><th scope="row">Caricabatterie DC/DC</th><td>Ricarica la batteria di servizio dall'alternatore mentre il motore è acceso</td><td>Corrente in ampere (A), compatibilità con l'alternatore</td><td><a href="guida-impianto-elettrico-camper.html">Impianto elettrico</a></td></tr>
            <tr><th scope="row">Caricabatterie da rete</th><td>Ricarica la batteria da colonnina o presa a 230 V</td><td>Corrente in ampere (A), profilo per il tipo di batteria</td><td><a href="guida-impianto-elettrico-camper.html">Impianto elettrico</a></td></tr>
            <tr><th scope="row">Inverter</th><td>Trasforma i 12 V della batteria in 230 V</td><td>Potenza continua e di picco in watt, onda sinusoidale pura, tensione di ingresso</td><td><a href="guida-impianto-elettrico-camper.html">Impianto elettrico</a></td></tr>
          </tbody>
        </table>
      </div>

      <h2>Da dove partire: i consumi</h2>
      <p>Il punto di partenza è quanta energia usi in un giorno. Per ogni apparecchio moltiplica la <strong>potenza in watt per le ore di utilizzo</strong>: il risultato è in Wh. La somma di tutti gli apparecchi è il consumo giornaliero. La capacità della batteria si calcola con <strong>Wh = V × Ah</strong>: per esempio, una batteria da 200 Ah a 12,8 V contiene 2.560 Wh. Dal consumo giornaliero si ricavano batteria e pannelli: scrivici i tuoi consumi e ti aiutiamo a fare il conto.</p>

      <h2>I tre errori più comuni</h2>
      <ol>
        <li><strong>Tensioni che non si parlano.</strong> Batteria, regolatore e inverter devono lavorare alla stessa tensione (12, 24 o 48 V). Collegando più pannelli in serie la tensione si somma: controlla che resti sotto il massimo del regolatore.</li>
        <li><strong>Regolatore sottodimensionato.</strong> Se i pannelli possono produrre più di quanto il regolatore riesce a gestire, il regolatore limita la produzione: non si rompe niente, ma si perde energia nelle giornate di sole pieno. Come ordine di grandezza, la potenza massima dei pannelli gestita è la corrente del regolatore per la tensione di carica della batteria (circa 14,6 V per una batteria al litio da 12,8 V): un regolatore da 30 A su un impianto a 12 V gestisce circa 440 W. È un dato indicativo: verifica sempre la scheda del costruttore.</li>
        <li><strong>Cavi e protezioni sottodimensionati.</strong> La sezione dei cavi dipende dalla corrente e dalla lunghezza del percorso, e ogni linea ha bisogno del suo fusibile vicino alla batteria. Cavi troppo sottili scaldano e fanno perdere tensione. Il dimensionamento lo definiamo caso per caso, sul tuo mezzo.</li>
      </ol>

      <h2>I componenti che vendiamo</h2>
      <h3>Pannelli solari</h3>
${list(panels)}
      <h3>Regolatori di carica MPPT</h3>
${list(regulators)}
      <h3>Batterie al litio</h3>
${list(batteries)}
      <h3>Caricabatterie DC/DC (dall'alternatore)</h3>
${list(dcdc)}
      <h3>Caricabatterie da rete</h3>
${list(mains)}
      <h3>Inverter</h3>
${list(inverters)}
${kitActive ? `
      <h2>Il kit completo in promozione</h2>
      <p>Per un impianto al litio da 620 Ah (7.936 Wh) con ricarica da alternatore, dal sole e da rete e inverter a 230 V abbiamo un kit completo a ${eur(KIT620.supplyCents)} (fornitura, IVA inclusa), valido fino al ${KIT620.validUntil}. <a href="guida-kit-litio-620ah-promozione.html">Vedi cosa comprende</a>.</p>
` : ''}
      <h2>Fornitura e montaggio</h2>
      <p>Spediamo in tutta Italia. Su richiesta, il montaggio può essere eseguito presso la nostra officina di Tivoli (Strada Arci 24); in alternativa, l'installazione può essere effettuata in autonomia o da un tecnico di fiducia.</p>

      <div class="guide-note"><strong>Non ancora provato in officina.</strong> Questa pagina riporta i principi generali di dimensionamento e i dati dichiarati dai costruttori. Non contiene misure fatte da noi su impianti montati: se le aggiungeremo, saranno indicate con data e mezzo.</div>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>

      <div class="guide-links">
        <a href="contatti.html" class="btn btn-primary btn-sm">Chiedi un consiglio</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
        <a href="guida-regolatore-mppt-o-pwm.html" class="btn btn-outline btn-sm">MPPT o PWM</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Batteria al litio</a>
      </div>`
  };
}

// ---------- Pagina indice: tutte le guide e i confronti ----------
// ---------- Guida: inverter caricabatterie Victron MultiPlus-II ----------
// Dati dalla scheda tecnica del costruttore (come riportata dal rivenditore Manelservice, 22/10/2026) e
// dall'etichetta dell'apparecchio fotografato in officina (12 V, 3000, 120 A, 32 A, 230 V, IP21).
// Peso e dimensioni NON compaiono finche' non sono confermati. Se il prodotto non e' attivo la guida non viene generata.
const MULTIPLUS_SLUG = 'cda-0221-victron-multiplus-ii-12-3000-120-32';
function buildMultiPlusGuide(products) {
  const mp = products.find((p) => p.slug === MULTIPLUS_SLUG);
  if (!mp) return null;
  const inv = products.find((p) => p.slug === 'cda-0192-inverter-onda-pura-3000w-bypass');
  const chg = products.find((p) => p.slug === 'cda-0194-caricabatterie-mestic-mbc-1040-40a');
  const mppt = products.find((p) => p.slug === 'cda-0190-regolatore-mppt-victron-100-30');
  const faq = [
    ['Che cos\'è un inverter caricabatterie?', 'È un apparecchio che fa tre lavori insieme: trasforma i 12 V della batteria in 230 V per le prese di bordo, ricarica la batteria quando c\'è la rete o il generatore e passa da una fonte all\'altra in automatico.'],
    ['Quanta potenza dà davvero il MultiPlus-II 12/3000/120-32?', 'Dà 3000 VA, cioè 2400 W continui a 25 °C. Con il caldo la potenza continua scende: 2200 W a 40 °C e 1700 W a 65 °C. Il picco è di 5500 W.'],
    ['Funziona con le batterie al litio?', 'Sì: sull\'etichetta dell\'apparecchio è indicato che si possono caricare batterie al piombo o al litio. Va sempre abbinato a una batteria a 12 V che regga la corrente richiesta.'],
    ['Quanta corrente prende dalla batteria?', 'A pieno carico, 2400 W divisi per 12 V fanno circa 200 A, più le perdite. Per questo servono una batteria adatta, cavi di sezione adeguata e un fusibile giusto: è un lavoro da fare a regola d\'arte.'],
    ['Posso usarlo con la colonnina del campeggio?', 'Sì: il commutatore di trasferimento è da 32 A. Con la rete disponibile i consumi passano dalla rete e la batteria si ricarica; con la funzione PowerAssist, se i consumi superano la rete disponibile, l\'apparecchio aggiunge la corrente della batteria.'],
    ['Lo montate voi?', 'Sì, nel nostro centro tecnico di Tivoli, per i prodotti acquistati da noi. Il montaggio si fa soltanto in officina.']
  ];
  const sumAlt = inv && chg ? inv.price_cents + chg.price_cents : 0;
  const altRows = [
    [`<a href="prodotto-${esc(mp.slug)}.html">${esc(mp.name)}</a>`, 'Un solo apparecchio: inverter 3000 VA, caricabatterie fino a 120 A e commutatore rete/batteria da 32 A', eur(mp.price_cents), esc(shippingNote(mp))]
  ];
  if (inv && chg) {
    altRows.push([`<a href="prodotto-${esc(inv.slug)}.html">${esc(inv.name)}</a><br>+ <a href="prodotto-${esc(chg.slug)}.html">${esc(chg.name)}</a>`, 'Due apparecchi: inverter a onda pura da 3000 W con by-pass sulla rete esterna e caricabatterie da 40 A', eur(sumAlt) + ' (somma dei due)', 'Spedizione calcolata nel carrello']);
  }
  return {
    file: 'guida-inverter-caricabatterie-multiplus-ii-camper.html',
    shortTitle: 'Inverter caricabatterie Victron MultiPlus-II',
    title: 'Inverter caricabatterie camper: Victron MultiPlus-II | CDA',
    description: 'Victron MultiPlus-II 12/3000/120-32: inverter, caricabatterie 120 A e commutatore rete/batteria in un solo apparecchio per il camper. Dati, consumi e prezzo.',
    h1: 'Inverter caricabatterie per camper: Victron MultiPlus-II 12/3000/120-32',
    lead: 'Che cosa fa, quanta potenza dà davvero, cosa serve per usarlo bene e quando conviene rispetto a inverter e caricabatterie separati.',
    faq,
    body: `      <p><strong>In breve:</strong> il Victron MultiPlus-II 12/3000/120-32 è un inverter, un caricabatterie e un commutatore rete/batteria in un solo apparecchio. Dà 3000 VA (2400 W continui a 25 °C, picco 5500 W), carica le batterie fino a 120 A e ha un commutatore di trasferimento da 32 A. Costa ${eur(mp.price_cents)}.</p>

      <h2>Tre apparecchi in uno</h2>
      <ul>
        <li><strong>Inverter:</strong> trasforma i 12 V della batteria in 230 V (50 Hz) per le prese del camper.</li>
        <li><strong>Caricabatterie:</strong> ricarica la batteria dalla colonnina o dal generatore con una corrente fino a 120 A.</li>
        <li><strong>Commutatore automatico:</strong> con la rete disponibile i consumi passano dalla rete (fino a 32 A); se la rete manca, l'inverter prende la corrente dalla batteria.</li>
      </ul>
      <p>In più, la funzione <strong>PowerAssist</strong> aiuta la rete: se la colonnina o il generatore non bastano per i consumi del momento, l'apparecchio aggiunge la corrente della batteria.</p>

      <h2>Dati tecnici</h2>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Dato</th><th>Valore</th></tr></thead>
          <tbody>
<tr><td>Tensione della batteria</td><td>12 V (ingresso da 9,5 a 17 V)</td></tr>
<tr><td>Potenza continua</td><td>3000 VA; 2400 W a 25 °C, 2200 W a 40 °C, 1700 W a 65 °C</td></tr>
<tr><td>Potenza di picco</td><td>5500 W</td></tr>
<tr><td>Uscita</td><td>230 V ±2%, 50 Hz</td></tr>
<tr><td>Corrente di carica massima</td><td>120 A</td></tr>
<tr><td>Commutatore di trasferimento</td><td>32 A</td></tr>
<tr><td>Efficienza massima</td><td>93%</td></tr>
<tr><td>Consumo a vuoto</td><td>13 W</td></tr>
<tr><td>Batterie</td><td>Al piombo o al litio (come indicato sull'etichetta)</td></tr>
<tr><td>Uso</td><td>Solo all'interno; grado di protezione IP21 secondo l'etichetta dell'apparecchio</td></tr>
<tr><td>Dimensioni e peso</td><td>546 x 275 x 147 mm, 19 kg (scheda tecnica Victron)</td></tr>
          </tbody>
        </table>
      </div>
      <p>I dati sono quelli della scheda tecnica del costruttore e dell'etichetta dell'apparecchio. La potenza continua scende con il caldo: tienine conto se lo monti in un vano che si scalda.</p>

      <h2>Cosa puoi alimentare</h2>
      <p>Il limite è la potenza continua: <strong>somma i watt degli apparecchi che usi insieme</strong> (li trovi sull'etichetta di ciascuno) e tieni un po' di margine rispetto ai 2400 W. Piano a induzione, macchina del caffè o microonde possono stare dentro questo limite, ma non tutti insieme e non a ogni potenza: controlla i dati del tuo apparecchio. I carichi con un picco di avviamento alto, come un compressore, usano la riserva di potenza fino a 5500 W.</p>

      <div class="guide-note"><strong>Occhio alla batteria.</strong> A pieno carico l'inverter prende dalla batteria circa 200 A (2400 W ÷ 12 V), più le perdite. Servono una batteria che regga quella corrente in scarica, cavi di sezione adeguata e un fusibile giusto. Prima di ordinare confronta i dati della tua batteria con la <a href="guida-batteria-litio-camper.html">guida alle batterie al litio</a>.</div>

      <h2>Un apparecchio solo o due separati?</h2>
      <p>Per avere inverter e caricabatterie si può scegliere anche la soluzione a due apparecchi. I numeri a catalogo:</p>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Soluzione</th><th>Cosa offre</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${tableRows(altRows)}
          </tbody>
        </table>
      </div>
      <ul>
        <li><strong>MultiPlus-II:</strong> un solo apparecchio da installare, ricarica molto più veloce (120 A) e commutazione automatica rete/batteria integrata.</li>
        <li><strong>Due apparecchi:</strong> più flessibili se hai già uno dei due o se ti basta una ricarica più lenta (40 A).</li>
      </ul>

      <h2>Come abbinarlo</h2>
      <ul>
        <li><strong>Batteria a 12 V al litio</strong> capace di erogare la corrente richiesta: vedi la <a href="guida-batteria-litio-camper.html">guida alle batterie al litio</a>.</li>
        <li><strong>Solare:</strong> il MultiPlus-II non include un regolatore solare.${mppt ? ' Per i pannelli abbinalo a un regolatore MPPT come il <a href="prodotto-' + esc(mppt.slug) + '.html">' + esc(mppt.name) + '</a> (' + eur(mppt.price_cents) + ').' : ''} Vedi la <a href="guida-fotovoltaico-camper.html">guida al fotovoltaico</a> e quella all'<a href="guida-impianto-elettrico-camper.html">impianto elettrico</a>.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
${faq.map((f) => `        <dt>${esc(f[0])}</dt>\n        <dd>${esc(f[1])}</dd>`).join('\n')}
      </dl>

      <div class="guide-note"><strong>Impianto da dimensionare?</strong> Dicci cosa vuoi alimentare e per quanto tempo: chiamaci al <a href="tel:+393489905455">348 990 5455</a> e lo calcoliamo insieme prima di ordinare.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello.</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi: un impianto elettrico va collegato a regola d'arte. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA, nella nostra officina.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <div class="guide-links">
        <a href="prodotto-${esc(mp.slug)}.html" class="btn btn-primary btn-sm">Vedi il MultiPlus-II</a>
        <a href="categoria-elettronica-inverter-regolatori.html" class="btn btn-outline btn-sm">Inverter e regolatori</a>
        <a href="guida-impianto-elettrico-camper.html" class="btn btn-outline btn-sm">Guida all'impianto elettrico</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
      </div>`
  };
}

function buildGuideHub(guides) {
  const groups = [
    ['Energia e batterie', ['guida-fotovoltaico-camper.html', 'guida-kit-litio-620ah-promozione.html', 'guida-batteria-litio-camper.html', 'guida-batteria-200ah-ultimatron-extrapower.html', 'guida-impianto-elettrico-camper.html', 'guida-inverter-caricabatterie-multiplus-ii-camper.html', 'guida-regolatore-mppt-o-pwm.html']],
    ['Clima e riscaldamento', ['guida-climatizzatore-camper.html', 'guida-riscaldamento-camper.html', 'guida-pannello-pu5-o-comfort-autoterm.html', 'guida-stufa-truma-s-3004-o-5004.html']],
    ['Acqua e frigorifero', ['guida-impianto-acqua-camper.html', 'guida-frigorifero-camper.html']]
  ];
  const byFile = {};
  guides.forEach((g) => { byFile[g.file] = g; });
  const used = new Set();
  const item = (g) => `        <li><a href="${esc(g.file)}"><strong>${esc(g.h1)}</strong></a><br><span>${esc(g.description)}</span></li>`;
  let body = "      <p>Guide all'acquisto e confronti tra i prodotti che vendiamo: tabelle con dati dalle schede dei costruttori, prezzi letti dal nostro catalogo e le domande da farsi prima di ordinare. Dove non abbiamo ancora provato un prodotto in officina lo scriviamo.</p>\n";
  groups.forEach((grp) => {
    const list = grp[1].filter((f) => byFile[f]);
    if (list.length === 0) return;
    list.forEach((f) => used.add(f));
    body += `\n      <h2>${esc(grp[0])}</h2>\n      <ul class="guide-hub-list">\n${list.map((f) => item(byFile[f])).join('\n')}\n      </ul>\n`;
  });
  const rest = guides.filter((g) => !used.has(g.file));
  if (rest.length) body += `\n      <h2>Altre guide</h2>\n      <ul class="guide-hub-list">\n${rest.map(item).join('\n')}\n      </ul>\n`;
  body += `\n      <div class="guide-note"><strong>Non trovi quello che cerchi?</strong> Chiamaci al <a href="tel:+393489905455">348 990 5455</a>: ti consigliamo in base al tuo camper e ai tuoi consumi.</div>\n      <div class="guide-links">\n        <a href="shop.html" class="btn btn-primary btn-sm">Vai allo shop</a>\n        <a href="servizi.html" class="btn btn-outline btn-sm">Servizi e montaggio a Tivoli</a>\n      </div>`;
  return {
    file: 'guide.html',
    shortTitle: 'Guide e confronti',
    title: 'Guide e confronti per camper | CDA Tivoli',
    description: "Guide all'acquisto e confronti tra batterie, climatizzatori, riscaldamento, impianto acqua ed elettrico per camper, con prezzi aggiornati.",
    h1: 'Guide e confronti per il tuo camper',
    lead: 'Come scegliere batterie, riscaldamento, climatizzatore, impianto acqua ed elettrico: tabelle chiare e prezzi aggiornati.',
    body
  };
}

async function main() {
  const shell = siteShell();
  const [dometic, batterie, riscaldamento, acqua, elettrico, frigoriferi, kitProdotti, pannelli, caricabatterie, multiplus] = await Promise.all([
    fetchProducts('name=ilike.*fresh*'),
    fetchProducts('name=ilike.batteria*'),
    fetchProducts('or=(name.ilike.*riscald*,name.ilike.*stufa*,name.ilike.*autoterm*,name.ilike.*travel box*)'),
    fetchProducts('or=(name.ilike.pompa*,name.ilike.serbatoio*)'),
    fetchProducts('or=(name.ilike.inverter*,name.ilike.regolatore*,name.ilike.carica batterie*)'),
    fetchProducts('name=ilike.frigorifero*'),
    fetchProducts('slug=in.(cda-0177-batteria-litio-ultimatron-ulm-12-620,cda-0190-regolatore-mppt-victron-100-30,cda-0191-pannello-solare-all-black-300w,cda-0192-inverter-onda-pura-3000w-bypass,cda-0193-caricabatterie-dc-dc-victron-orion-xs-50a,cda-0194-caricabatterie-mestic-mbc-1040-40a)'),
    fetchProducts('name=ilike.pannello solare*'),
    fetchProducts('or=(name.ilike.caricabatterie*,name.ilike.carica batterie*)'),
    fetchProducts('slug=in.(' + MULTIPLUS_SLUG + ',cda-0192-inverter-onda-pura-3000w-bypass,cda-0194-caricabatterie-mestic-mbc-1040-40a,cda-0190-regolatore-mppt-victron-100-30)')
  ]);

  const guides = [buildClimateGuide(dometic), buildBatteryGuide(batterie), buildHeatingGuide(riscaldamento), buildWaterGuide(acqua), buildPowerGuide(elettrico), buildFridgeGuide(frigoriferi), buildBattery200Compare(batterie), buildPanelCompare(riscaldamento), buildTrumaCompare(riscaldamento), buildMpptCompare(elettrico), buildKitLitio620(kitProdotti), buildSolarPillar(pannelli, elettrico.filter((p) => /^Regolatore/i.test(p.name)), batterie, elettrico.filter((p) => /^Inverter/i.test(p.name)), caricabatterie), buildMultiPlusGuide(multiplus)].filter(Boolean);
  // Parte alta con foto, numero e schede con carrello su tutte le guide (la guida riscaldamento ha la sua, piu' ricca).
  const HEROES = {
    'guida-climatizzatore-camper.html': { eyebrow: 'Clima in camper', list: dometic, sub: 'per un climatizzatore da tetto Dometic: FreshJet, Freshlight e Freshwell a confronto' },
    'guida-batteria-litio-camper.html': { eyebrow: 'Energia', list: batterie, sub: 'per una batteria al litio per il camper: ExtraPOWER e Ultimatron a confronto' },
    'guida-impianto-acqua-camper.html': { eyebrow: 'Impianto acqua', list: acqua, sub: "per pompe e serbatoi dell'impianto acqua del camper" },
    'guida-impianto-elettrico-camper.html': { eyebrow: 'Impianto elettrico', list: elettrico, sub: 'per inverter, regolatori e caricabatterie del camper' },
    'guida-frigorifero-camper.html': { eyebrow: 'Frigorifero', list: frigoriferi, sub: 'per un frigorifero a compressore per camper' },
    'guida-batteria-200ah-ultimatron-extrapower.html': { eyebrow: 'Batterie 200 Ah', list: batterie.filter((p) => /200/.test(p.name)), sub: 'per una batteria al litio da 200 Ah: ExtraPOWER e Ultimatron a confronto' },
    'guida-pannello-pu5-o-comfort-autoterm.html': { eyebrow: 'Riscaldatore Autoterm', list: riscaldamento.filter((p) => /Autoterm Air 2D con pannello/i.test(p.name)), sub: 'per il riscaldatore Autoterm Air 2D: pannello PU-5 o Comfort' },
    'guida-stufa-truma-s-3004-o-5004.html': { eyebrow: 'Stufa a gas', list: riscaldamento.filter((p) => /truma/i.test(p.name)), sub: 'per la stufa a gas Truma S: 3004 o 5004' },
    'guida-regolatore-mppt-o-pwm.html': { eyebrow: 'Energia solare', list: elettrico.filter((p) => /^Regolatore/i.test(p.name)), sub: 'per un regolatore di carica solare' },
    'guida-fotovoltaico-camper.html': { eyebrow: 'Fotovoltaico', list: pannelli, sub: 'per un pannello solare per il camper' },
    'guida-inverter-caricabatterie-multiplus-ii-camper.html': { eyebrow: 'Inverter e caricabatterie', list: multiplus.filter((p) => /0221/.test(p.slug)), sub: 'Victron MultiPlus-II 12/3000: inverter e caricabatterie in uno' }
  };
  guides.forEach((g) => {
    const spec = HEROES[g.file];
    if (spec && g.body.indexOf('guide-hero') === -1) {
      const html = genericHero(spec);
      if (html) g.body = html + g.body;
    }
  });
  guides.forEach((g) => {
    fs.writeFileSync(path.join(ROOT, g.file), pageHtml(shell, g), 'utf8');
    console.log('Generata', g.file);
  });
  injectHomeKitPromo();
  const hubPage = buildGuideHub(guides);
  fs.writeFileSync(path.join(ROOT, hubPage.file), pageHtml(shell, hubPage), 'utf8');
  console.log('Generata', hubPage.file);

  // sitemap: rimuove le vecchie voci guida-* e le riaggiunge
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/cda-camper\.it\/guid[ae][-.][^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  const entries = guides.concat([hubPage]).map((g) => `  <url>\n    <loc>${SITE_URL}/${g.file}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
  sitemap = sitemap.replace('</urlset>', entries.join('\n') + '\n</urlset>\n');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  console.log('sitemap.xml aggiornata con le guide.');
}

main().catch((err) => { console.error(err); process.exit(1); });

// ---- Parte alta comune delle guide (per chi arriva da post e annunci) ----
function guideCartButton(p) {
  return '<button class="add-btn add-btn-lg" data-product-id="' + esc(p.id) + '" data-product-name="' + esc(p.name) + '" data-product-price="' + p.price_cents + '" data-product-image="' + esc(p.image_url || '') + '" aria-label="Aggiungi al carrello: ' + esc(p.name) + '">Aggiungi al carrello</button>';
}

function genericHero(spec) {
  const list = (spec.list || []).filter((p) => p.id && p.image_url && p.price_cents > 0).sort((a, b) => a.price_cents - b.price_cents);
  if (list.length === 0) return '';
  const picks = list.length <= 3 ? list : [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];
  const big = list.length === 1 ? eur(list[0].price_cents) : 'da ' + eur(list[0].price_cents);
  const allFree = list.every(freeShippingFor);
  const cards = picks.map((p) => '<div class="guide-card">'
    + (p.brand ? '<span class="guide-card-tag">' + esc(p.brand) + '</span>' : '')
    + '<a href="prodotto-' + esc(p.slug) + '.html"><img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy"></a>'
    + '<div class="guide-card-name guide-card-name-lg"><a href="prodotto-' + esc(p.slug) + '.html">' + esc(p.name) + '</a></div>'
    + '<div class="guide-card-price">' + eur(p.price_cents) + (freeShippingFor(p) ? ' <small>· spedizione gratuita</small>' : '') + '</div>'
    + guideCartButton(p) + '</div>').join('');
  return '<div class="guide-hero">'
    + '<div class="guide-hero-text"><span class="guide-hero-eyebrow">' + esc(spec.eyebrow) + '</span>'
    + '<div class="guide-hero-big sm">' + big + '</div>'
    + '<p class="guide-hero-sub">' + esc(spec.sub) + '.</p>'
    + '<p class="guide-hero-note">Prezzi letti dal nostro catalogo' + (allFree ? '. Spedizione gratuita.' : '.') + ' Montaggio nella nostra officina di Tivoli per i prodotti acquistati da noi.</p>'
    + '<a href="#scegli" class="btn guide-hero-cta">Scegli il modello</a></div>'
    + '<img class="guide-hero-img" src="' + esc(picks[picks.length - 1].image_url) + '" alt="' + esc(picks[picks.length - 1].name) + '"></div>'
    + '<h2 id="scegli">Alcuni modelli, subito nel carrello</h2>'
    + '<div class="guide-cards">' + cards + '</div>'
    + '<p class="guide-cards-note">Reso entro 14 giorni. Il confronto completo di tutti i modelli è qui sotto.</p>';
}
