# CLAUDE.md

## 1. Contesto

E-commerce di accessori e ricambi per camper, unito all'officina riparazioni (prenotazioni e assistenza).

- Lingua: italiano.
- Tono verso i clienti: pratico, esperto ed empatico con i camperisti.

## 2. Regole fisse

- **Investigate before answering**: ispeziona e verifica sempre l'architettura dei file prima di rispondere o applicare modifiche.
- **Planning mode**: mostra sempre un piano operativo dettagliato e attendi l'approvazione prima di eseguire compiti complessi.
- **Clarification**: poni sempre 2-3 domande di chiarimento su scope, formato e obiettivo prima di iniziare.
- **Summary**: fornisci un riassunto chiaro di tutte le modifiche eseguite al termine di ogni operazione.
- **Parallel execution**: sfrutta l'esecuzione parallela dei sotto-agenti per velocizzare i task.

## 3. Struttura del progetto

- `workflows/`: file di istruzioni per i bot di nicchia.
- `risorse/` (o `input/`): file CSV di vendita, inventario o foto.
- `output/`: destinazione di report, pacchetti social o comunicazioni ordinate.

## 4. Architettura del sito (cda-camper.it)

> Il codice aggiornato del sito sta sul branch `feature/ga4-conversion-tracking`. Su `main` oggi c'è solo lo scheletro iniziale. Prima di modificare il sito, controlla su quale branch stai lavorando.

### Frontend
- Sito statico in HTML, CSS e JavaScript puro, senza framework né bundler. Un solo foglio di stile, `stile.css`.
- `js/main.js`: carrello in `localStorage`, filtri shop, caroselli, banner cookie, form preventivi, eventi GA4 e Meta Pixel. `js/supabase-config.js`: client Supabase con la sola chiave pubblica.
- Pagine principali: `index.html`, `shop.html`, `catalogo.html`, `prodotto.html`, `carrello.html`, `ordine-confermato.html`, `servizi.html`, `lavorazioni.html`, `contatti.html`, `chi-siamo.html`, `guide.html`, `camper-usati.html`.
- Pagine generate: `prodotto-<slug>.html`, `guida-*.html` e `camper-usato-*.html` vengono rigenerate dagli script in `scripts/` a ogni deploy. Le `categoria-*.html` sono statiche.
- Area riservata: `admin.html` (login Supabase Auth) e `admin-ordini.html` (dashboard ordini).
- Risorse: `images/` e `foto/` per le immagini, `docs/certificazioni/` per le schede tecniche PDF.

### Backend: Supabase (progetto `udynqqqxjcyhdeygqumi`)
- Tabelle principali: `categories` e `subcategories`, `products` (prezzi in centesimi, compatibilità veicolo, kit tramite `bundle_items`, `product_attributes`), `orders` e `order_items`, `quote_requests`, `newsletter_signups` e `newsletter_drafts`, `testimonials` (recensioni), `social_posts`, `site_settings`.
- `supabase/schema.sql` è lo schema di partenza, `supabase/migrations/` contiene le modifiche successive in ordine numerato.
- Edge function in `supabase/functions/`: checkout Stripe (`create-checkout-session`, `stripe-webhook`), contrassegno (`create-cod-order`), notifiche preventivi, newsletter, promemoria carrello, feed Google Shopping (`product-feed`), post social programmati, tracciamento del funnel e backup del database.
- Sicurezza: RLS attiva. Dal browser si leggono solo catalogo, recensioni e impostazioni del sito, e si inseriscono solo preventivi e iscrizioni alla newsletter. Le chiavi segrete (Stripe, service role, Resend) stanno solo nei secret di Supabase, mai nel codice.

### Deploy e strumenti
- Hosting su Netlify, configurato in `netlify.toml` (comando di build, header di sicurezza, `_redirects`). Il piano ha crediti limitati: ogni deploy costa crediti.
- Analytics: GA4 (`G-H2W2W8FGY6`) con eventi e-commerce, Meta Pixel, Google Search Console e Merchant Center.
- Server locale: `node scripts/dev-server.js` sulla porta 8642 (vedi `.claude/launch.json`).

### File di lavoro
- `TODO.md`: diario di lavoro con lo stato aggiornato del sito. Va letto per primo.
- `prezzi-prodotti.csv`: costi fornitore e prezzi. Il database non ha un campo costo.
