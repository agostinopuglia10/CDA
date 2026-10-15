-- CAMPEGGIO: prodotti e categorie pronti per il lancio. BOZZA, NON ESEGUIRE senza passare dalla lista qui sotto.
-- Preparato il 15/10/2026. Provato con rollback sul database reale il 15/10 (nessuna riga rimasta).
--
-- Blocco A = 3 frigo Invision in "Cucina" (categoria gia' esistente: nessuna pagina/menu nuovo, rischio minimo).
-- Blocco B = nuova categoria "Campeggio" con i prodotti pronti. Metterla online SOLO quando ha almeno 8-10 prodotti:
--            una categoria nel menu con 3 prodotti e' pagina debole per Google e poco utile al cliente.
--
-- LISTA PRIMA DI ESEGUIRE (a metà gennaio, solo se indicizzazione >= 90% e almeno 1 ordine reale):
--  1. Rileggere sul sito GES il prezzo al pubblico e la tabella "Qta / Prezzo" (il primo prezzo puo' valere per 5 pezzi).
--  2. Ricontrollare il prezzo del concorrente il giorno stesso (Invision: nessun concorrente identico trovato il 15/10).
--  3. Verificare che le foto images/prodotti/cda-0195..0200 esistano in repo.
--  4. Sostituire il prezzo se e' cambiato e aggiornare prezzi-prodotti.csv.
--  5. Eseguire il blocco (begin ... commit), poi: node scripts/apply-campeggio-nav.js (solo per il blocco B),
--     node scripts/build-product-pages.js && node scripts/build-guide-pages.js && node scripts/build-camper-usati.js, push.
--  6. Search Console: richiesta di indicizzazione della categoria nuova; IndexNow; controllo del feed Google (peso, categoria).
--
-- Costo fornitore (GES, area rivenditori 15/10/2026), prezzo = pubblico GES - 0,01, margine = prezzo/1,22 - costo:
--  FRG020 186,00 -> 334,99  (margine 88,58)   FRG030 203,00 -> 364,99 (96,17)   FRG041 217,00 -> 369,99 (86,27)
--  TAV108  62,00 -> 111,99  (margine 29,79)   SED107  65,00 -> 116,99 (30,89)   CAR02   37,00 ->  73,99 (23,65)
-- Prodotti senza magazzino (stock 0): si ordina al fornitore dopo la vendita, come per il resto del catalogo.

-- ===================== BLOCCO A: frigo Invision in Cucina =====================
begin;

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category)
select v.slug, (select id from categories where path = 'interni.cucina'), v.name, v.description, v.price_cents, v.image_url, 0, true, 'Invision', v.weight_kg, v.dimensions_cm,
       'Home & Garden > Kitchen & Dining > Kitchen Appliances > Refrigerators'
from (values
  ('cda-0195-frigo-invision-22-l', 'Frigorifero portatile a compressore Invision 22 L',
   'Frigorifero portatile a compressore Invision da 22 litri (cod. FRG020), pensato per furgoni e camper. Si alimenta a 12 V o 24 V, con temperatura regolabile da -18 °C a 10 °C e funzionamento garantito con temperature ambiente da 10 a 43 °C (classe climatica SN/N/ST/T). Il pannello di controllo permette di accenderlo, spegnerlo e impostare la temperatura. Dimensioni 580 x 335 x 356 mm, peso 12,5 kg.',
   33499, 'images/prodotti/cda-0195-frigo-invision-22-l.jpg', 12.5, '58x33.5x35.6'),
  ('cda-0196-frigo-invision-28-l', 'Frigorifero portatile a compressore Invision 28 L',
   'Frigorifero portatile a compressore Invision da 28 litri (cod. FRG030), pensato per furgoni e camper. Si alimenta a 12 V o 24 V, con temperatura regolabile da -18 °C a 10 °C e funzionamento garantito con temperature ambiente da 10 a 43 °C (classe climatica SN/N/ST/T). Il pannello di controllo permette di accenderlo, spegnerlo e impostare la temperatura. Dimensioni 580 x 335 x 356 mm, peso 13,5 kg.',
   36499, 'images/prodotti/cda-0196-frigo-invision-28-l.jpg', 13.5, '58x33.5x35.6'),
  ('cda-0197-frigo-invision-41-l', 'Frigorifero portatile a compressore Invision 41 L',
   'Frigorifero portatile a compressore Invision da 41 litri (cod. FRG041), pensato per furgoni e camper. Si alimenta a 12 V o 24 V, con temperatura regolabile da -18 °C a 10 °C e funzionamento garantito con temperature ambiente da 10 a 43 °C (classe climatica SN/N/ST/T). Il pannello di controllo permette di accenderlo, spegnerlo e impostare la temperatura. Dimensioni 737 x 410 x 403 mm, peso 16,5-17 kg.',
   36999, 'images/prodotti/cda-0197-frigo-invision-41-l.jpg', 17, '73.7x41x40.3')
) as v(slug, name, description, price_cents, image_url, weight_kg, dimensions_cm)
where not exists (select 1 from products p where p.slug = v.slug);

commit;

-- ===================== BLOCCO B: categoria Campeggio =====================
begin;

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
select 'campeggio', 'Campeggio',
       'Tavoli, sedie e accessori da campeggio pieghevoli, da portare in camper per le soste all''aperto. Spedizione in tutta Italia.',
       7, null, 'campeggio', 1
where not exists (select 1 from categories where path = 'campeggio');

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
select 'tavoli-sedie', 'Tavoli e sedie',
       'Tavoli pieghevoli in alluminio e sedie da campeggio, leggeri da trasportare e veloci da montare.',
       1, c.id, 'campeggio.tavoli-sedie', 2
from categories c
where c.path = 'campeggio'
  and not exists (select 1 from categories where path = 'campeggio.tavoli-sedie');

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
select 'accessori-campeggio', 'Accessori da campeggio',
       'Carrelli pieghevoli e piccoli accessori per organizzare le soste in campeggio.',
       2, c.id, 'campeggio.accessori-campeggio', 2
from categories c
where c.path = 'campeggio'
  and not exists (select 1 from categories where path = 'campeggio.accessori-campeggio');

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category, gtin)
select v.slug, (select id from categories where path = v.cat_path), v.name, v.description, v.price_cents, v.image_url, 0, true, v.brand, v.weight_kg, v.dimensions_cm, v.gcat, v.gtin
from (values
  ('cda-0198-tavolo-silver-gapless-level-4', 'campeggio.tavoli-sedie', 'Tavolo pieghevole Silver Gapless level 4', 'Brunner',
   'Tavolo pieghevole da campeggio in alluminio anodizzato con piano a listelli arrotolabile (cod. TAV108). Ha la livella e la gamba regolabile in altezza, per mettere il piano perfettamente in bolla anche su terreno irregolare. Dimensioni da aperto 110 x 71 x 70 cm, da chiuso 107 x 18 x 20 cm, peso 7,1 kg, portata massima 30 kg.',
   11199, 'images/prodotti/cda-0198-tavolo-silver-gapless-level-4.jpg', 7.1, '107x18x20', 'Furniture > Outdoor Furniture > Outdoor Tables', null),
  ('cda-0199-sdraio-acapulco', 'campeggio.tavoli-sedie', 'Sedia sdraio Acapulco', null,
   'Sedia sdraio da campeggio con struttura in alluminio (cod. SED107). Lo schienale si regola in sette posizioni e il tessuto traforato lascia passare l''aria. Dimensioni da aperta 74 x 57 x 121 cm, da chiusa 45 x 47,5 x 40 cm, peso 4,6 kg, portata massima 120 kg.',
   11699, 'images/prodotti/cda-0199-sdraio-acapulco.jpg', 4.6, '45x47.5x40', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs', null),
  ('cda-0200-carrello-pieghevole-50-kg', 'campeggio.accessori-campeggio', 'Carrello pieghevole fino a 50 kg', null,
   'Carrello pieghevole in alluminio per trasportare bagagli, casse e spesa fino a 50 kg (cod. CAR02). Le ruote grandi in plastica permettono di spostarlo su qualsiasi terreno. Dimensioni da chiuso 69 x 38 x 5,5 cm, da aperto 69 x 38 x 35 cm, peso 2,2 kg.',
   7399, 'images/prodotti/cda-0200-carrello-pieghevole-50-kg.jpg', 2.2, '69x38x5.5', 'Hardware > Tools > Dollies & Hand Trucks', '8715133025630')
) as v(slug, cat_path, name, brand, description, price_cents, image_url, weight_kg, dimensions_cm, gcat, gtin)
where not exists (select 1 from products p where p.slug = v.slug);

commit;

-- ===================== CONTROLLI DOPO L'ESECUZIONE =====================
-- select slug, active, price_cents, weight_kg, category_id is not null as con_categoria from products where slug like 'cda-019[5-9]%' or slug like 'cda-0200%';
-- select path, depth, sort_order from categories where path like 'campeggio%' order by path;
