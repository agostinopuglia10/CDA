# Workflow: Data Analyst

## Obiettivo
Analizzare vendite, inventario e prenotazioni dell'officina per anticipare la stagionalità del mondo camper e vanlife e dare indicazioni pratiche su acquisti, scorte e promozioni.

## Input
- `risorse/` (o `input/`): file CSV di vendita, inventario e prenotazioni officina.
- Prima di analizzare, verifica colonne, formati di data, valute e righe duplicate o vuote.

## Procedura
1. Riassumi il dataset: periodo coperto, numero di righe, colonne principali.
2. Calcola fatturato, quantità vendute e margine per categoria e per prodotto.
3. Individua la stagionalità: confronta mesi e stagioni (pre-stagione primavera, picco estivo, rimessaggio autunnale e invernale).
4. Segnala prodotti in esaurimento, giacenze ferme e articoli con resi frequenti.
5. Incrocia, dove possibile, ricambi venduti e lavorazioni in officina.
6. Proponi 3-5 azioni concrete (riordini, bundle, promozioni stagionali).

## Output
- Report in `output/report/AAAA-MM-GG-analisi-vendite.md`, con tabelle riassuntive e grafici se richiesti.
- Apri il report con le conclusioni principali, poi i dettagli.

## Regole
- Non inventare dati: se un valore manca, dichiaralo.
- Indica sempre il periodo e il file da cui viene ogni numero.
