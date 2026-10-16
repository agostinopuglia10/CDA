# Workflow: Data Analyst

Procedure standard per analizzare le vendite di ricambi e accessori camper, incrociarle con la stagionalità dell'officina e salvare i report in `output/`.

## Obiettivo
Capire cosa si vende, quando e perché, per anticipare la stagionalità del settore camper e vanlife: riordini in tempo, scorte giuste e promozioni nel momento in cui servono.

## Fasi di adozione
- **Fase 1 (attuale): CSV esportati a mano.** Lavora solo sui file in `risorse/` (o `input/`). Non leggere il database e non chiamare API: serve a collaudare la qualità delle analisi e affinare queste istruzioni.
- **Fase 2: fonti reali.** Parte solo quando l'utente conferma che la fase 1 è collaudata. Le fonti diventano gli ordini su Supabase (in sola lettura), GA4 e `prezzi-prodotti.csv` per i costi. Il briefing esistente `briefing-bot-analisi-dati.md` (sul branch del sito) va unito in questo file.

## Input attesi
In fase 1 tutti i file si trovano in `risorse/` (o `input/`).

| File | Contenuto minimo | Colonne tipiche |
|---|---|---|
| Vendite (`vendite_*.csv`) | Una riga per articolo venduto | data, numero ordine, SKU, nome prodotto, categoria, quantità, prezzo unitario, sconto, totale, canale |
| Inventario (`inventario_*.csv`) | Giacenza attuale per articolo | SKU, nome prodotto, categoria, giacenza, costo d'acquisto, fornitore, scorta minima |
| Officina (`officina_*.csv`) | Una riga per prenotazione o lavorazione | data, tipo di lavorazione, veicolo, ricambi usati (SKU), ore, importo |

Se i nomi delle colonne sono diversi, mappali a quelli sopra e riporta la mappatura nel report.

## Procedura

### 1. Controllo dei file
1. Elenca i file trovati, il periodo coperto e il numero di righe.
2. Verifica il formato delle date (GG/MM/AAAA o AAAA-MM-GG), il separatore (`,` o `;`) e il separatore decimale (`,` o `.`).
3. Segnala righe vuote, duplicate (stesso ordine e SKU), quantità negative (resi) e SKU senza categoria.
4. Non correggere i dati in silenzio: elenca ogni pulizia applicata.

### 2. Analisi delle vendite di ricambi
1. Fatturato, quantità e numero di ordini per mese.
2. Classifica per categoria e per SKU (prime 20 voci per fatturato e per quantità).
3. Margine per categoria, se l'inventario riporta il costo d'acquisto.
4. Confronto con lo stesso periodo dell'anno precedente, se ci sono i dati.
5. Resi: incidenza per categoria e SKU con resi frequenti.

### 3. Stagionalità
Raggruppa i mesi nelle stagioni del settore:

| Stagione | Mesi | Cosa aspettarsi |
|---|---|---|
| Pre-stagione | febbraio-aprile | tagliandi, batterie, gas, revisioni, preparazione al viaggio |
| Alta stagione | maggio-agosto | accessori da viaggio, tendalini, frigo, climatizzazione, guasti in viaggio |
| Fine stagione | settembre-ottobre | riparazioni dopo l'estate, rimessaggio |
| Inverno | novembre-gennaio | antigelo, coperture, riscaldamento, lavori lunghi in officina |

1. Calcola per ogni categoria l'indice stagionale (vendite del mese diviso la media mensile).
2. Indica in che mese parte la domanda di ogni categoria, così da riordinare 4-6 settimane prima.

### 4. Incrocio con l'officina
1. Prenotazioni e lavorazioni per mese e per tipo.
2. Confronta l'andamento delle prenotazioni con le vendite di ricambi della stessa categoria (esempio: interventi sull'impianto gas e vendite di regolatori e tubi).
3. Individua i ricambi usati spesso in officina, per non restare senza nei mesi di picco.
4. Segnala i mesi in cui officina e shop sono entrambi al picco: lì servono più scorte e più personale.

### 5. Inventario e azioni
1. Articoli sotto la scorta minima, o che lo saranno all'inizio della prossima stagione.
2. Giacenze ferme da più di 6 mesi.
3. Proponi 3-5 azioni concrete: riordini con data consigliata, bundle (esempio: kit pre-stagione), promozioni per smaltire le giacenze ferme.

## Output
Salva tutto in `output/report/`, con questi nomi:
- `AAAA-MM-GG-analisi-vendite.md`: il report completo.
- `AAAA-MM-GG-riordini.csv`: SKU, giacenza, scorta minima, quantità consigliata, data di riordino.
- `AAAA-MM-GG-grafici/`: grafici, se richiesti (vendite mensili, indice stagionale, officina e shop a confronto).

Struttura del report:
1. **Conclusioni**: 3-5 punti con le cose più importanti da fare.
2. **Dati usati**: file, periodo, pulizie applicate.
3. **Vendite**: tabelle per mese, categoria e SKU.
4. **Stagionalità**: indice per categoria e mesi di partenza della domanda.
5. **Officina**: andamento e incrocio con le vendite.
6. **Inventario e azioni**: riordini, giacenze ferme, proposte.

## Regole
- Non inventare dati: se un valore manca, dichiaralo.
- Per ogni numero indica file e periodo da cui viene.
- Lascia invariati i file in `risorse/`: lavora sempre su copie.
- Importi in euro, con due decimali.
