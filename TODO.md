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
- [ ] **Recensioni clienti reali**: non c'è ancora nessuna recensione vera, quindi la sezione "Cosa dicono i clienti" in home ora resta **nascosta automaticamente** finché non ce n'è almeno una (niente più placeholder finto `[Nome cliente]`). Per aggiungerne una in futuro non serve toccare il codice: Supabase → Table Editor → tabella `testimonials` → Insert row, compilando solo `customer_name` e `review_text` — appare da sola sul sito appena salvata.
- [ ] **Email reali**: `info@cda-camper.it` e l'email di notifica preventivi sono ancora placeholder.
- [ ] **Tempi di consegna**: nessuna promessa mostrata di proposito finché non c'è un tempo medio reale. Pronto un meccanismo guidato per quando ci sarà: Supabase → Table Editor → tabella `site_settings` → riga con `id=1` → compila `delivery_time_text` (es. "5-7 giorni lavorativi") → compare da solo nella home (trust-strip) e nella scheda prodotto.
- [ ] **Conferma numero di telefono definitivo** (389 547 2846) prima della pubblicazione.
- [ ] **Autorizzazione scritta** per le immagini prodotto prese da fornitori (Euro Accessoires Italia / GES), se non già ottenuta in forma scritta/verificabile.

## 🟢 Rifiniture minori (non bloccanti)

- [ ] Sottocategoria **Esterni → Aperture** non ha ancora una foto dedicata. Avevo provato un collage AI da foto prodotto GES (finestra + braccetti Seitz), ma l'ho tolto: è un'opera derivata da foto di terzi senza autorizzazione, rischio più alto delle normali foto prodotto — da rifare solo con foto autorizzate o un'immagine neutra senza prodotti di terzi riconoscibili.
- [x] **Sottocategoria dedicata per i catadiottri**: creata **Esterni → Segnaletica e Sicurezza**, i 15 catadiottri sono stati spostati lì (verificato: filtro sottocategoria testato e funzionante). Il kit di livellamento Level Up in realtà era già corretto sotto "Interni → Garage", non era orfano.
- [x] **Bundle/kit reali**: nota precedente sbagliata — esistono già **6 kit reali** in catalogo (Toilette da Viaggio €149, Impianto Acqua Fissa €194, Garage da Viaggio €179, Comfort Cabina Guida €259, Riscaldamento Invernale €749, Veranda Motorizzata €969), ognuno con componenti veri, sconto reale, foto e descrizione. Verificato direttamente su Supabase il 2026-08-14.
- [x] **Kit messi in evidenza**: tutti e 6 ora `featured = true` (prima 2 non lo erano senza motivo) — nessun prodotto in evidenza è senza foto (verificato).
- [x] **Risparmio visibile ovunque**: il badge dei kit ora mostra l'importo reale risparmiato ("Risparmi 70,50€") in tutte le viste — shop, categoria, carosello in evidenza, prodotti correlati — non solo nella scheda prodotto.
- [ ] **Sconto kit da portare al 10%**: richiesto di alzare lo sconto dei 3 kit più deboli (Riscaldamento Invernale 5,4%, Comfort Cabina Guida 6,8%, Toilette da Viaggio 6,9%) almeno al 10%. **Bloccato**: verificato che i prezzi attuali dei componenti sul sito coincidono esattamente (al centesimo) col prezzo pubblico di GES International, non un vero prezzo da rivenditore. CDA acquista già realmente da GES International ed Euro Accessoires Italia (l'account rivenditore esiste), ma l'utente personalmente non ha i contatti/le credenziali, e al momento i fornitori sono chiusi per ferie estive. Da riprendere quando l'utente recupera l'accesso (referente interno CDA o riapertura post-ferie) — nessuna azione automatizzabile nel frattempo.
  - Contatti pubblici disponibili se servono per riattivare l'accesso: GES International +39 02 22471848 / gesinternational.it/contactus; Euro Accessoires Italia (gruppo Trigano) +39 0577-6501 / euroaccessoiresitalia.it/IT-it/Shop/Login

## 🌐 Anteprima online

- [x] Sito pubblicato in anteprima (sola visualizzazione) su Netlify, collegato al branch `feature/ga4-conversion-tracking` del repo GitHub — si aggiorna da solo a ogni push: **https://relaxed-strudel-133bd6.netlify.app**. Da non confondere con il lancio reale: manca ancora dominio definitivo, Stripe attivo, dati reali.

## ✅ Già confermato reale (non serve ritoccare)

- Orari di apertura (08:30–13:00, 14:30–18:00) confermati reali dall'utente.
- Indirizzo: Via Arci n.24, Tivoli (RM).
- Telefono: 389 547 2846.
- GA4 Measurement ID reale collegato.
