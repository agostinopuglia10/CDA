# TODO — prima della pubblicazione

Stato: la struttura del sito (pagine, database, categorie, carrello, kit, SEO base) è completa e testata. Quello che resta è contenuto reale, dati definitivi e due integrazioni da accendere e collaudare.

## 🔴 Da fare prima di aprire davvero al pubblico

- [ ] **Stripe checkout**: il codice esiste ed è stato distribuito (`supabase/functions/create-checkout-session`) ma manca ancora la chiave segreta Stripe (`STRIPE_SECRET_KEY` nei secrets della Edge Function su Supabase) — senza quella non funziona. Va aggiunta e testata con un pagamento reale (anche da 1€, poi rimborsato) prima di fidarsene.
- [ ] **Notifica email nuove richieste**: Edge Function scritta e distribuita (`supabase/functions/notify-new-quote`) ma non collegata — serve un account Resend, le chiavi `RESEND_API_KEY`/`NOTIFY_EMAIL` nei secrets, e configurare il Database Webhook su Supabase.
- [ ] **P.IVA e ragione sociale**: in attesa del commercialista. Una volta definite, vanno aggiornate `privacy.html` e `termini.html` (oggi sono ancora scheletri generici) e il footer di tutte le pagine.
- [x] **Foto prodotto**: 197 prodotti su 200 hanno ora un'immagine reale (collegata direttamente ai server di Euro Accessoires Italia / GES — verifica di avere l'autorizzazione scritta, vedi punto sotto). Restano solo 3 senza foto (nessun match affidabile trovato sui siti dei fornitori, meglio lasciarli vuoti che sbagliare): **Presa 12V 7 Pin in PVC/plastica**, **Presa esterna 220V con salvavita Bticino**, **Mastice per ricostruzione legno 1 litro**.
- [x] **Feed prodotti Google Shopping**: `supabase/functions/product-feed` distribuita e verificata funzionante (risponde con XML valido). Genera in automatico il feed con tutti i prodotti che hanno foto+prezzo reale. Prima di attivarlo su Google Merchant restano da fare: 1) il sito deve essere pubblicato su un dominio reale (Google verifica che i link prodotto siano raggiungibili), 2) verificare l'autorizzazione sulle immagini (stesso punto sopra).
- [x] **Campo "brand" corretto**: rimosso il nome del grossista dal campo `brand` (era il caso per 134 prodotti). Ora ogni prodotto ha il produttore reale verificato sui siti dei fornitori (Autoterm, Dometic, Fiamma, Thetford, Thule, Truma, Victron Energy, ecc.) oppure `brand = NULL` per gli articoli generici/senza marchio (116 prodotti, verificato non essere un errore).

## 🟡 Contenuti reali da inserire

- [x] **Prodotti Clima da GES**: 31 prodotti reali inseriti (17 climatizzatori: ExtraCLIMA, Openair, Dometic FreshJet/Freshlight/Freshwell; 14 riscaldatori/stufe: Autoterm Air, Truma, generici gasolio). Prezzo segnaposto 0€ per i nuovi, tranne i 7 già presenti da una sessione precedente (8 agosto) con prezzo reale — tra questi c'è anche un kit reale già esistente, "Kit Riscaldamento Invernale" (€749, con bundle_items veri). Prezzi a 0€ da aggiornare quando hai i costi GES definitivi.
- [x] **Descrizioni prodotto**: tutti i ~200 prodotti hanno ora una descrizione finale, pronta per la pubblicazione (niente più note interne tipo "Codice fornitore"/"verificare prezzo"). Copy orientato al beneficio, coerente con lo stile del sito.
- [x] **Modello di spedizione chiarito**: niente magazzino/ritiro in sede per ora — si spedisce direttamente dal fornitore all'indirizzo del cliente una volta ricevuto l'ordine. Ho tolto tutte le menzioni di "ritiro a Tivoli" da meta description, trust-strip e pagina d'ordine (erano promesse false col modello attuale). La riga "Disponibilità" sulla pagina prodotto ora è dinamica: legge il campo `stock` del prodotto, pronta per il giorno in cui terrai qualcosa a magazzino.
- [ ] **Recensioni clienti reali**: ho messo una sezione segnaposto ben visibile in home ("Cosa dicono i clienti") con `[Nome cliente]`/`[Recensione da inserire]` — o la riempi con recensioni vere o va tolta prima di pubblicare, non può restare così com'è.
- [ ] **Email reali**: `info@cda-camper.it` e l'email di notifica preventivi sono ancora placeholder.
- [ ] **Tempi di consegna**: ora che sappiamo che si spedisce dal fornitore, serve il tempo medio realistico (dipende dal fornitore) per un badge tipo "Consegna in X giorni lavorativi" — oggi non c'è nessuna promessa sui tempi, di proposito, finché non hai il dato.
- [ ] **Conferma numero di telefono definitivo** (389 547 2846) prima della pubblicazione.
- [ ] **Autorizzazione scritta** per le immagini prodotto prese da fornitori (Euro Accessoires Italia / GES), se non già ottenuta in forma scritta/verificabile.

## 🟢 Rifiniture minori (non bloccanti)

- [ ] Sottocategoria **Esterni → Aperture** non ha ancora una foto dedicata. Avevo provato un collage AI da foto prodotto GES (finestra + braccetti Seitz), ma l'ho tolto: è un'opera derivata da foto di terzi senza autorizzazione, rischio più alto delle normali foto prodotto — da rifare solo con foto autorizzate o un'immagine neutra senza prodotti di terzi riconoscibili.
- [ ] I 15 catadiottri e il kit di livellamento importati sono finiti su "Esterni" generico (nessuna sottocategoria adatta oggi) — valutare se creare una sottocategoria dedicata quando il catalogo cresce.
- [ ] Nessun kit/bundle reale esiste ancora nel catalogo (funzionalità pronta e testata, manca solo crearne uno vero quando ha senso commercialmente).

## ✅ Già confermato reale (non serve ritoccare)

- Orari di apertura (08:30–13:00, 14:30–18:00) confermati reali dall'utente.
- Indirizzo: Via Arci n.24, Tivoli (RM).
- Telefono: 389 547 2846.
- GA4 Measurement ID reale collegato.
