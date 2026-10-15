-- CAMPEGGIO: prodotti e categorie pronti per il lancio. BOZZA, NON ESEGUIRE senza passare dalla lista qui sotto.
-- Preparato il 15/10/2026. Provato con rollback sul database reale il 15/10 (nessuna riga rimasta).
--
-- Blocco A = 3 frigo Invision in "Cucina" (categoria gia' esistente: nessuna pagina/menu nuovo, rischio minimo).
-- Blocco B = nuova categoria "Campeggio" (3 sottocategorie) con i 7 prodotti che hanno GIA' tutti i dati (peso incluso).
-- Blocco C = altri 7 prodotti per Campeggio, COMMENTATO: manca il peso (o altro) su GES. Il checkout usa 0,5 kg se il peso manca,
--            quindi un prodotto senza peso NON va attivato. Completare i dati, togliere i commenti, poi eseguire.
-- Mettere online Campeggio SOLO quando ha almeno 8-10 prodotti (B + parte di C): meno di cosi' e' una pagina debole.
--
-- LISTA PRIMA DI ESEGUIRE (metà gennaio, solo se indicizzazione >= 90% e almeno 1 ordine reale):
--  1. Rileggere sul sito GES prezzo al pubblico e tabella "Qta / Prezzo" (il primo prezzo puo' valere per 5 pezzi).
--  2. Ricontrollare il prezzo del concorrente il giorno stesso (Invision: nessun concorrente identico il 15/10).
--  3. Verificare che le foto images/prodotti/cda-0195..0211 esistano in repo.
--  4. Aggiornare prezzi-prodotti.csv se il prezzo cambia.
--  5. Eseguire i blocchi (begin ... commit), poi: node scripts/apply-campeggio.js (solo per Campeggio),
--     node scripts/build-product-pages.js && node scripts/build-guide-pages.js && node scripts/build-camper-usati.js, push.
--  6. Search Console: richiesta di indicizzazione della categoria nuova; IndexNow; controllo feed Google (peso, categoria).
--  7. Cartucce di butano: NON vendere (merce pericolosa, non viaggia con i corrieri normali) fino a verifica col corriere.
--
-- Costo fornitore (GES, area rivenditori 15/10/2026), prezzo = pubblico GES - 0,01, margine = prezzo/1,22 - costo:
--  FRG020 186,00 -> 334,99 (88,58)   FRG030 203,00 -> 364,99 (96,17)   FRG041 217,00 -> 369,99 (86,27)
--  TAV108  62,00 -> 111,99 (29,79)   SED107  65,00 -> 116,99 (30,89)   CAR02   37,00 ->  73,99 (23,65)
--  FRN04   80,00 -> 143,99 (38,02)   FRN01   20,00 ->  39,99 (12,78)   CAR01   17,20 ->  33,99 (10,66)   CAR03 46,00 -> 91,99 (29,40)
--  (blocco C) FRN03 58,00 -> 115,99 (37,07)  FRN1405 14,50 -> 28,99 (9,26)  BBQ01 12,00 -> 23,99 (7,66)  SED111 29,00 -> 57,99 (18,53)
--             SED110 13,00 -> 25,99 (8,30)   TAV8515 10,20 -> 19,99 (6,19)  DCC03 13,00 -> 25,99 (8,30)
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

-- ===================== BLOCCO B: categoria Campeggio + 7 prodotti completi =====================
begin;

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
select 'campeggio', 'Campeggio',
       'Tavoli, sedie, fornelli e accessori da campeggio pieghevoli, da portare in camper per le soste all''aperto. Spedizione in tutta Italia.',
       7, null, 'campeggio', 1
where not exists (select 1 from categories where path = 'campeggio');

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
select s.slug, s.name, s.description, s.sort_order, c.id, 'campeggio.' || s.slug, 2
from (values
  ('tavoli-sedie', 'Tavoli e sedie', 'Tavoli pieghevoli in alluminio e sedie da campeggio, leggeri da trasportare e veloci da montare.', 1),
  ('cucina-campeggio', 'Fornelli e cucina da campeggio', 'Fornelli e grill a gas portatili per cucinare all''aperto durante le soste.', 2),
  ('accessori-campeggio', 'Accessori da campeggio', 'Carrelli pieghevoli e piccoli accessori per organizzare le soste in campeggio.', 3)
) as s(slug, name, description, sort_order)
join categories c on c.path = 'campeggio'
where not exists (select 1 from categories x where x.path = 'campeggio.' || s.slug);

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category, gtin)
select v.slug, (select id from categories where path = v.cat_path), v.name, v.description, v.price_cents, v.image_url, 0, true, v.brand, v.weight_kg, v.dimensions_cm, v.gcat, v.gtin
from (values
  ('cda-0198-tavolo-silver-gapless-level-4', 'campeggio.tavoli-sedie', 'Tavolo pieghevole Silver Gapless level 4', 'Brunner',
   'Tavolo pieghevole da campeggio in alluminio anodizzato con piano a listelli arrotolabile (cod. TAV108). Ha la livella e la gamba regolabile in altezza, per mettere il piano perfettamente in bolla anche su terreno irregolare. Dimensioni da aperto 110 x 71 x 70 cm, da chiuso 107 x 18 x 20 cm, peso 7,1 kg, portata massima 30 kg.',
   11199, 'images/prodotti/cda-0198-tavolo-silver-gapless-level-4.jpg', 7.1, '107x18x20', 'Furniture > Outdoor Furniture > Outdoor Tables', null),
  ('cda-0199-sdraio-acapulco', 'campeggio.tavoli-sedie', 'Sedia sdraio Acapulco', null,
   'Sedia sdraio da campeggio con struttura in alluminio (cod. SED107). Lo schienale si regola in sette posizioni e il tessuto traforato lascia passare l''aria. Dimensioni da aperta 74 x 57 x 121 cm, da chiusa 45 x 47,5 x 40 cm, peso 4,6 kg, portata massima 120 kg.',
   11699, 'images/prodotti/cda-0199-sdraio-acapulco.jpg', 4.6, '45x47.5x40', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs', null),
  ('cda-0201-grill-butano-devil-double', 'campeggio.cucina-campeggio', 'Fornelletto grill a butano Devil Double', null,
   'Fornello a gas a due piani con piastra in alluminio pressofuso, due bruciatori in alluminio con fiamma regolabile e accensione piezoelettrica integrata (cod. FRN04). Potenza 2,9 kW. Dimensioni del fornello 67,9 x 28,6 x 12,5 cm, della piastra 53 x 28 x 2,6 cm, peso 7,4 kg. Si alimenta a butano: il gas si acquista a parte.',
   14399, 'images/prodotti/cda-0201-grill-butano-devil-double.jpg', 7.4, '67.9x28.6x12.5', 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Outdoor Grills', '8022068055046'),
  ('cda-0202-fornello-gas-portatile', 'campeggio.cucina-campeggio', 'Fornello a gas portatile con valigetta', null,
   'Fornello a gas portatile con accensione piezo e regolazione della fiamma (cod. FRN01). Ha lo sgancio automatico della cartuccia con riarmo manuale in caso di sovrapressione, secondo la norma EN 17476/2021. Potenza 2.200 W, consumo 160 g/h, temperatura della fiamma 700 °C. Si trasporta nella valigetta in plastica. Dimensioni 34 x 25 x 8,5 cm, peso 1,99 kg. La cartuccia di gas non è inclusa.',
   3999, 'images/prodotti/cda-0202-fornello-gas-portatile.jpg', 1.99, '34x25x8.5', 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Portable Cooking Stoves', '8008004134716'),
  ('cda-0200-carrello-pieghevole-50-kg', 'campeggio.accessori-campeggio', 'Carrello pieghevole fino a 50 kg', null,
   'Carrello pieghevole in alluminio per trasportare bagagli, casse e spesa fino a 50 kg (cod. CAR02). Le ruote grandi in plastica permettono di spostarlo su qualsiasi terreno. Dimensioni da chiuso 69 x 38 x 5,5 cm, da aperto 69 x 38 x 35 cm, peso 2,2 kg.',
   7399, 'images/prodotti/cda-0200-carrello-pieghevole-50-kg.jpg', 2.2, '69x38x5.5', 'Hardware > Tools > Dollies & Hand Trucks', '8715133025630'),
  ('cda-0203-carrello-pieghevole-30-kg', 'campeggio.accessori-campeggio', 'Carrello pieghevole fino a 30 kg', null,
   'Carrello pieghevole con cinghia e ganci in metallo per fissare il carico (cod. CAR01). Portata 30 kg, piano d''appoggio 30 x 26 cm. Dimensioni da chiuso 59 x 26 x 15 cm, peso 2,13 kg.',
   3399, 'images/prodotti/cda-0203-carrello-pieghevole-30-kg.jpg', 2.13, '59x26x15', 'Hardware > Tools > Dollies & Hand Trucks', '8715133023469'),
  ('cda-0204-carrello-pieghevole-70-kg', 'campeggio.accessori-campeggio', 'Carrello pieghevole fino a 70 kg', null,
   'Carrello pieghevole in alluminio per trasportare carichi fino a 70 kg (cod. CAR03). Le ruote grandi in plastica permettono di spostarlo su qualsiasi terreno. Dimensioni da chiuso 73 x 49 x 6 cm, da aperto 100 x 49 x 42 cm, peso 4 kg.',
   9199, 'images/prodotti/cda-0204-carrello-pieghevole-70-kg.jpg', 4, '73x49x6', 'Hardware > Tools > Dollies & Hand Trucks', '8715133030771')
) as v(slug, cat_path, name, brand, description, price_cents, image_url, weight_kg, dimensions_cm, gcat, gtin)
where not exists (select 1 from products p where p.slug = v.slug);

commit;

-- ===================== BLOCCO C (COMMENTATO): mancano dati su GES =====================
-- Da chiedere a GES prima di attivare: peso e imballo di ognuno; per FRN01 quale bruciatore e' montato (standard o ceramica);
-- per FRN1405 se la cartuccia della foto e' inclusa e di che tipo (il testo parla di cartucce forabili, la foto ne mostra una a vite);
-- per SED111 la lunghezza del pacco chiuso (102 cm: vedere soglia "lungo").
-- Quando i dati arrivano: sostituire i NULL del peso con il valore, togliere i commenti ed eseguire come gli altri blocchi.
--
-- insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category, gtin)
-- select v.slug, (select id from categories where path = v.cat_path), v.name, v.description, v.price_cents, v.image_url, 0, true, null, v.weight_kg, v.dimensions_cm, v.gcat, v.gtin
-- from (values
--   ('cda-0205-grill-butano-cartucce-227-g', 'campeggio.cucina-campeggio', 'Grill a butano per cartucce da 227 g',
--    'Griglia a gas con piastra di cottura antiaderente e bruciatore in acciaio inox da 1,9 kW (cod. FRN03). Ha la regolazione della fiamma e l''accensione piezo. Funziona con cartucce di butano da 227 g, non incluse. Comprende una sacca in plastica per il trasporto.',
--    11599, 'images/prodotti/cda-0205-grill-butano-cartucce-227-g.jpg', null::numeric, null::text, 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Outdoor Grills', '8008004122560'),
--   ('cda-0206-fornello-campeggio-cartuccia', 'campeggio.cucina-campeggio', 'Fornello da campeggio a cartuccia',
--    'Fornello portatile a gas con piattello antivento in acciaio inox, che aumenta la potenza della fiamma (cod. FRN1405). Funziona con cartucce di butano forabili, estraibili solo quando completamente scariche; la base ha un sistema di sicurezza brevettato antisblocco della cartuccia. Accensione tradizionale, senza piezo. La cartuccia di gas non è inclusa.',
--    2899, 'images/prodotti/cda-0206-fornello-campeggio-cartuccia.jpg', null, null, 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Portable Cooking Stoves', '8008004089009'),
--   ('cda-0207-barbecue-pieghevole', 'campeggio.cucina-campeggio', 'Barbecue pieghevole a carbonella',
--    'Barbecue a carbonella richiudibile in acciaio, con paratia antivento e gambe removibili: si ripone in poco spazio quando non si usa (cod. BBQ01). Dimensioni totali 36 x 31 x 45 cm.',
--    2399, 'images/prodotti/cda-0207-barbecue-pieghevole.jpg', null, null, 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Outdoor Grills', null),
--   ('cda-0208-sedia-ombrello-deluxe-2', 'campeggio.tavoli-sedie', 'Sedia ombrello Deluxe 2',
--    'Sedia pieghevole tipo ombrello con ampia seduta, imbottita da un sottile strato di gommapiuma nel tessuto (cod. SED111). La struttura tubolare robusta e il sedile largo la rendono stabile. Si ripiega in pochi secondi e si porta con la custodia in dotazione. Dimensioni totali 60 x 88 x 110 cm, da piegata 18 x 18 x 102 cm.',
--    5799, 'images/prodotti/cda-0208-sedia-ombrello-deluxe-2.jpg', null, '18x18x102', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs', null),
--   ('cda-0209-sedia-pieghevole-52x52', 'campeggio.tavoli-sedie', 'Sedia pieghevole con portabevande',
--    'Sedia pieghevole con robusto telaio in metallo, ampio schienale, seduta larga e braccioli con portabevande (cod. SED110). Si ripiega in pochi secondi. Dimensioni da aperta 52 x 52 x 68 cm, altezza della seduta da terra 30 cm.',
--    2599, 'images/prodotti/cda-0209-sedia-pieghevole-52x52.jpg', null, null, 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs', null),
--   ('cda-0210-tavolino-multiuso', 'campeggio.accessori-campeggio', 'Tavolino multiuso pieghevole',
--    'Tavolino pieghevole multifunzione per PC portatile, cibi e bevande, che si può appendere anche al volante (cod. TAV8515).',
--    1999, 'images/prodotti/cda-0210-tavolino-multiuso.jpg', null, null, 'Furniture > Outdoor Furniture > Outdoor Tables', '8711293489312'),
--   ('cda-0211-doccia-campeggio-pompetta-12v', 'campeggio.accessori-campeggio', 'Doccia da campeggio con pompa 12 V',
--    'Doccetta con pompa a immersione 12 V per taniche e ghirbe, da collegare alla presa accendisigari (cod. DCC03). Portata 8 litri al minuto, tubo da 2 m. Comprende supporto con ventosa per fissare il doccino alla parete del camper, gancio multifit e sacca per il trasporto.',
--    2599, 'images/prodotti/cda-0211-doccia-campeggio-pompetta-12v.jpg', null, null, 'Sporting Goods > Outdoor Recreation > Camping & Hiking > Portable Toilets & Showers > Portable Showers & Privacy Enclosures', null)
-- ) as v(slug, cat_path, name, description, price_cents, image_url, weight_kg, dimensions_cm, gcat, gtin)
-- where not exists (select 1 from products p where p.slug = v.slug);

-- ===================== CONTROLLI DOPO L'ESECUZIONE =====================
-- select slug, active, price_cents, weight_kg, category_id is not null as con_categoria from products where slug ~ '^cda-(019[5-9]|020[0-9]|021[01])';
-- select path, depth, sort_order from categories where path like 'campeggio%' order by path;
