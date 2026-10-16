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

### Sito esistente

- Pagine HTML statiche nella radice (`index.html`, `shop.html`, `prodotto.html`, `carrello.html`, `servizi.html`, `lavorazioni.html`, ecc.) con un unico foglio di stile `stile.css`.
- `js/`: `main.js` (logica del sito) e `supabase-config.js` (connessione a Supabase).
- `supabase/`: `schema.sql`, `migrations/` e la edge function `functions/create-checkout-session` per il checkout.
- Avvio in locale: `python -m http.server 8642` (vedi `.claude/launch.json`).
