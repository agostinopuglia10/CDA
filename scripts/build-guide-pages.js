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
  const url = SUPABASE_URL + '/rest/v1/products?select=name,slug,brand,price_cents,shipping_included,weight_kg,description'
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
        <a href="guida-batteria-200ah-ultimatron-extrapower.html" class="btn btn-outline btn-sm">Confronto batterie da 200 Ah</a>
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
  if (/PU-5/i.test(p.name)) return 'PU-5 (base)';
  if (/Comfort/i.test(p.name)) return 'Comfort (retroilluminato, timer settimanale)';
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
  const rowsHtml = (rows, valueCol) => rows.map((r) => `<tr>${r.map((c, i) => `<td${i === r.length - 2 ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('\n');

  return {
    file: 'guida-riscaldamento-camper.html',
    shortTitle: 'Guida al riscaldamento per camper',
    title: 'Riscaldamento camper: gasolio, gas o portatile | CDA Tivoli',
    description: 'Come scegliere il riscaldamento per il camper: riscaldatori a gasolio Autoterm, stufe a gas Truma, pannelli di controllo e prezzi aggiornati.',
    h1: 'Riscaldamento per camper: gasolio, gas o portatile?',
    lead: 'Le tre soluzioni che vendiamo, a confronto, con i prezzi aggiornati e le cose da controllare prima di ordinare (compreso il pannello di controllo).',
    body: `      <p>Con l'arrivo del freddo, scaldare il camper diventa la priorità. Le soluzioni che teniamo a catalogo sono tre: il <strong>riscaldatore a gasolio indipendente</strong> (Autoterm), la <strong>stufa a gas</strong> (Truma) e il <strong>riscaldatore portatile</strong> (Travel Box). Qui trovi come si differenziano. I prezzi sono letti dal nostro catalogo e si aggiornano da soli.</p>

      <h2>Riscaldatore a gasolio indipendente</h2>
      <p>Un riscaldatore a gasolio funziona in modo indipendente e si installa in modo fisso nel camper. I modelli Autoterm hanno un motore brushless silenzioso e il funzionamento è garantito fino a −45 °C. La scelta è tra <strong>Air 2D</strong> (soluzione compatta) e <strong>Air 4D</strong> (più potenza per ambienti più grandi).</p>
      <div class="guide-note"><strong>Attenzione al pannello di controllo.</strong> Per accendere e regolare il riscaldatore serve un pannello. Nei modelli che lo riportano nel nome è incluso: <strong>PU-5</strong> (base) oppure <strong>Comfort</strong> (retroilluminato, con timer settimanale). I riscaldatori a gasolio da 2 kW e 4 kW senza pannello e il Kit Riscaldamento Invernale <strong>non lo includono</strong>: va aggiunto a parte.</div>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead><tr><th>Modello</th><th>Pannello</th><th>Note</th><th>Prezzo</th><th>Spedizione</th></tr></thead>
          <tbody>
${rowsHtml(dieselRows)}
          </tbody>
        </table>
      </div>

      <h2>Stufa a gas</h2>
      <p>La stufa a gas Truma SL è la soluzione per chi preferisce il gas del camper: calore immediato e costante, con accensione automatica.</p>
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

      <h2>Come scegliere</h2>
      <ul>
        <li><strong>Dimensioni del camper.</strong> Per furgonati e camper di dimensioni contenute è pensata la soluzione compatta (Air 2D o il riscaldatore a gasolio da 2 kW); per ambienti più grandi guarda l'Air 4D, il 4 kW o la Truma SL 5004.</li>
        <li><strong>Gasolio o gas?</strong> Il riscaldatore a gasolio funziona in modo indipendente; la stufa a gas usa l'impianto gas del camper. Scegli in base a quale combustibile preferisci avere a bordo.</li>
        <li><strong>Fisso o portatile?</strong> Il riscaldatore fisso va installato nel camper; il Travel Box si sposta dove serve e non richiede installazione fissa.</li>
        <li><strong>Pannello di controllo.</strong> Controlla sempre se è incluso (vedi riquadro sopra).</li>
      </ul>

      <div class="guide-note"><strong>Dubbi su quale scegliere o sull'installazione?</strong> Chiamaci al <a href="tel:+393489905455">348 990 5455</a> e ne parliamo prima che tu ordini.</div>

      <h2>Spedizione, ritiro e montaggio</h2>
      <ul>
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello (gratuita sopra 1.500 €).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi. Un riscaldatore fisso richiede collegamenti al combustibile e allo scarico: va fatto a regola d'arte. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <h2>Domande frequenti</h2>
      <dl class="guide-faq">
        <dt>Il pannello di controllo è incluso?</dt>
        <dd>Dipende dal modello: è incluso dove il nome riporta PU-5 o Comfort. Nei riscaldatori da 2 kW e 4 kW senza pannello e nel Kit Riscaldamento Invernale va aggiunto a parte.</dd>
        <dt>Che differenza c'è tra il pannello PU-5 e il Comfort?</dt>
        <dd>Il PU-5 è il pannello base; il Comfort è retroilluminato e ha il timer settimanale.</dd>
        <dt>Fino a quale temperatura funzionano i riscaldatori Autoterm?</dt>
        <dd>Secondo la scheda, il funzionamento è garantito fino a −45 °C.</dd>
        <dt>Lo montate voi?</dt>
        <dd>Sì, se lo acquisti da noi, nel nostro centro tecnico a Tivoli (Strada Arci n.24).</dd>
      </dl>

      <div class="guide-links">
        <a href="categoria-clima-riscaldatori-gasolio-gas.html" class="btn btn-primary btn-sm">Vedi tutti i riscaldatori</a>
        <a href="guida-climatizzatore-camper.html" class="btn btn-outline btn-sm">Guida al climatizzatore</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
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
  const mpptRows = mppt.map((p) => row(p, 'Impianti solari 12-24 V, con display LCD per monitorare la ricarica'));
  const invRows = inverters.map((p) => {
    const input = (p.name.match(/\b(12|24|48)V\b/) || [])[1] || (/Onda Sinusoidale/i.test(p.name) ? '12' : '');
    const mid = (/Onda Sinusoidale/i.test(p.name)) ? 'Ingresso 12 V, uscita 220 V, onda sinusoidale pura: per dispositivi sensibili'
      : 'Ingresso ' + input + ' V con regolatore MPPT integrato' + ((p.name.match(/MPPT (\d+)A/) || [])[1] ? ' da ' + (p.name.match(/MPPT (\d+)A/) || [])[1] + ' A' : '');
    return row(p, mid);
  });
  return {
    file: 'guida-impianto-elettrico-camper.html',
    shortTitle: 'Guida all\'impianto elettrico del camper',
    title: 'Inverter, MPPT e caricabatterie per camper: guida | CDA Tivoli',
    description: 'Come scegliere inverter, regolatore MPPT e caricabatterie per il camper: tensioni 12, 24 e 48 V, onda sinusoidale pura, prezzi aggiornati.',
    h1: 'Inverter, regolatore MPPT e caricabatterie per camper',
    lead: 'Che cosa fa ogni componente dell\'impianto elettrico, come abbinarli e quali modelli Alcapower abbiamo a catalogo, con prezzi aggiornati.',
    body: `      <p>Per avere corrente a bordo senza dipendere dalla rete servono tre pezzi che lavorano insieme: un <strong>caricabatterie</strong> (da rete o generatore), un <strong>regolatore di carica MPPT</strong> (dal pannello solare) e un <strong>inverter</strong> (che trasforma la corrente della batteria in corrente di rete a 220-230 V). Qui trovi i modelli Alcapower che teniamo a catalogo e come sceglierli. I prezzi si aggiornano da soli.</p>

      <h2>La regola da non dimenticare: la tensione</h2>
      <p>Batterie, inverter e regolatori devono parlare la <strong>stessa tensione</strong>: 12, 24 o 48 V. Nei nostri modelli, l'inverter a onda sinusoidale pura da 1500 W ha ingresso a 12 V, gli inverter da 2,4 e 3,5 kW a 24 V, il 5,5 kW a 48 V. Scegli prima la tensione del tuo impianto, poi il modello.</p>

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
      <p>Il regolatore MPPT gestisce la ricarica dal pannello solare e si adatta alla produzione, per sfruttare meglio il sole. Il modello a catalogo ha un display LCD per controllare la ricarica.</p>
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
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello (gratuita sopra 1.500 €).</li>
        <li><strong>Ritiro gratis in officina a Tivoli</strong>, senza spedizione.</li>
        <li><strong>Montaggio nel nostro centro tecnico</strong> per i prodotti acquistati da noi: un impianto elettrico va collegato a regola d'arte. Il montaggio lo facciamo soltanto per i prodotti acquistati da CDA.</li>
        <li><strong>Reso entro 14 giorni</strong> e garanzia legale di 24 mesi.</li>
      </ul>

      <div class="guide-links">
        <a href="categoria-elettronica-inverter-regolatori.html" class="btn btn-primary btn-sm">Vedi inverter e regolatori</a>
        <a href="guida-batteria-litio-camper.html" class="btn btn-outline btn-sm">Guida alle batterie al litio</a>
        <a href="guida-impianto-acqua-camper.html" class="btn btn-outline btn-sm">Guida all'impianto acqua</a>
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
    title: 'Frigorifero a compressore per camper: come scegliere | CDA Tivoli',
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
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello (gratuita sopra 1.500 €).</li>
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
        <li><strong>Spedizione in tutta Italia</strong>, con costo calcolato nel carrello in base a peso e dimensioni (inclusa nel prezzo per la Ultimatron ULM, gratuita sopra 1.500 €).</li>
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

async function main() {
  const shell = siteShell();
  const [dometic, batterie, riscaldamento, acqua, elettrico, frigoriferi] = await Promise.all([
    fetchProducts('name=ilike.*fresh*'),
    fetchProducts('name=ilike.batteria*'),
    fetchProducts('or=(name.ilike.*riscald*,name.ilike.*stufa*,name.ilike.*autoterm*,name.ilike.*travel box*)'),
    fetchProducts('or=(name.ilike.pompa*,name.ilike.serbatoio*)'),
    fetchProducts('or=(name.ilike.inverter*,name.ilike.regolatore*,name.ilike.carica batterie*)'),
    fetchProducts('name=ilike.frigorifero*')
  ]);

  const guides = [buildClimateGuide(dometic), buildBatteryGuide(batterie), buildHeatingGuide(riscaldamento), buildWaterGuide(acqua), buildPowerGuide(elettrico), buildFridgeGuide(frigoriferi), buildBattery200Compare(batterie)];
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
