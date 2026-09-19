-- Scoperto durante un controllo del sito come visitatore (2026-09-08): 22
-- prodotti attivi hanno image_url su euroaccessoiresitalia.it, dominio che
-- blocca il caricamento diretto dell'immagine da fuori dal proprio sito
-- (restituisce un GIF 1x1 trasparente, HTTP 200 ma nessuna foto reale —
-- verificato con curl, anche con Referer e User-Agent del loro sito).
-- Risultato: foto vuote/rotte per 4 prodotti "in evidenza" (incluso il
-- Kit Veranda Motorizzata) e 18 altri, sul sito pubblico.
--
-- Fix immediato: tolto image_url (torna il fallback grafico "Foto
-- prodotto" già esistente nel codice, invece di un'immagine rotta) e
-- tolto featured=true dai 4 in evidenza, finché non si trova una foto
-- vera utilizzabile. Il prezzo e la descrizione restano invariati.
update public.products
set image_url = null, featured = false
where active = true and image_url ilike '%euroaccessoiresitalia%';
