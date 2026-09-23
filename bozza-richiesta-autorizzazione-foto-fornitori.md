# Bozza email di conferma autorizzazione foto — da rivedere e inviare tu

Non l'ho inviata: è solo una bozza pronta, da personalizzare e mandare tu (o Maria).

**Perché mandarla anche se l'autorizzazione l'hai già avuta al telefono**: un accordo verbale non lascia traccia — se in futuro dovesse servire dimostrarlo (a Google, o in caso di contestazione), non c'è nulla da mostrare. Il modo standard è mandare un'email SUBITO DOPO la chiamata che riassume quanto concordato e chiede una conferma scritta. Anche se il fornitore non risponde, l'email che hai inviato tu resta comunque una prova datata di cosa è stato detto — meglio ancora se rispondono confermando.

---

## A GES International

**Oggetto**: Conferma per iscritto — autorizzazione uso immagini prodotto (rif. telefonata)

Buongiorno,

facendo seguito alla nostra telefonata, vi confermiamo per iscritto quanto discusso: CDA di Talucci Maria (rivenditore GES, Tivoli RM, P.IVA 04047161007) è autorizzata a utilizzare le immagini prodotto presenti sul vostro sito (gesinternational.it) anche in un feed Google Shopping, per mostrare i prodotti nei risultati di ricerca Google con foto e prezzo.

Vi chiediamo cortesemente di confermarcelo a vostra volta rispondendo a questa email, così da avere entrambi un riferimento scritto.

Grazie e buon lavoro,
CDA di Talucci Maria

---

## Ad Alcapower

**Oggetto**: Conferma per iscritto — autorizzazione uso immagini prodotto (rif. telefonata)

Buongiorno,

facendo seguito alla nostra telefonata, vi confermiamo per iscritto quanto discusso: CDA di Talucci Maria (rivenditore Alcapower, Tivoli RM, P.IVA 04047161007) è autorizzata a utilizzare le immagini prodotto presenti sul vostro sito (alcapower.com) anche in un feed Google Shopping.

Vi chiediamo cortesemente di confermarcelo a vostra volta rispondendo a questa email.

Grazie e buon lavoro,
CDA di Talucci Maria

---

## Nota tecnica (per chi implementa dopo)

Il feed prodotti (`product-feed` Edge Function, già live e funzionante) include oggi **163 prodotti**, così distribuiti per fonte immagine:
- 133 da gesinternational.it — serve questa autorizzazione
- 22 da alcapower.com — serve questa autorizzazione
- 8 da cda-camper.it (foto caricate da noi) — **già pronti, nessun blocco**

**Opzione "parti piccolo"**: si potrebbe attivare Google Merchant Center subito solo con questi 8 prodotti (batterie/climatizzatori Ultimatron, foto nostre) per testare che il meccanismo funzioni davvero (verifica sito, primo feed accettato, prime impressioni), mentre si aspetta la risposta dei fornitori — poi il feed si allarga da solo appena arriva l'autorizzazione, senza dover rifare nulla.
