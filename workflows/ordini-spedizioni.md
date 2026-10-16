# Workflow: Ordini e Spedizioni

## Obiettivo
Preparare comunicazioni chiare per i clienti in ogni fase dell'ordine e della spedizione, e per le prenotazioni dell'officina.

## Input
- Dati ordine: numero, prodotti, stato, corriere e codice di tracciamento.
- Per l'officina: data e ora della prenotazione, lavorazione richiesta, veicolo.

## Tono di voce
Pratico, esperto ed empatico: il cliente spesso ha un viaggio in programma, quindi date e tempi vanno detti in modo preciso.

## Messaggi da coprire
1. Conferma ordine.
2. Ordine spedito, con corriere e link di tracciamento.
3. Ritardo o prodotto non disponibile, con alternativa proposta.
4. Consegna avvenuta e richiesta di recensione.
5. Reso o rimborso.
6. Conferma, promemoria e modifica della prenotazione in officina.

## Output
- Testi in `output/comunicazioni/` (un file per tipo di messaggio), con oggetto email e versione breve per SMS o WhatsApp.

## Regole
- Usa solo i dati dell'ordine forniti: niente date di consegna inventate.
- Non inviare messaggi ai clienti: i testi restano bozze da approvare.
