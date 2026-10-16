-- CAMPEGGIO: prodotti e categorie pronti per il lancio. BOZZA, NON ESEGUIRE senza passare dalla lista qui sotto.
-- Preparato il 15/10/2026. Provato con rollback sul database reale il 15/10 (nessuna riga rimasta).
--
-- Blocco A = 3 frigo Invision in "Cucina" (categoria gia' esistente: nessuna pagina/menu nuovo, rischio minimo).
-- Blocco B = nuova categoria "Campeggio" (3 sottocategorie) con 7 prodotti con tutti i dati (peso incluso).
-- Blocco C = altri 7 prodotti GES per Campeggio con peso STIMATO (GES non lo indica; il checkout userebbe 0,5 kg se mancasse).
-- Blocco D = 9 sedie/sdraio/tavoli da Euro Accessoires Italia (margini 17-66 euro), pesi dalle schede salvo 2 stimati.
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

-- ===================== BLOCCO C: altri 7 prodotti GES per Campeggio (pesi STIMATI) =====================
-- FRN1405 (fornello a cartuccia) ESCLUSO: le foto GES mostrano una bombola collegata e non e' chiaro se e' inclusa; da chiedere a GES.
-- ATTENZIONE: i pesi di questo blocco sono STIME (15/10, GES non li indica), arrotondate per eccesso:
--   FRN03 grill 3,0 kg | FRN1405 fornello 0,5 kg (modello Kemper simile: 0,5 kg) | BBQ01 barbecue 3,0 kg | SED111 sedia ombrello 3,0 kg
--   SED110 sedia con braccioli 3,0 kg | TAV8515 tavolino 1,2 kg | DCC03 doccia con pompa 0,7 kg
-- Sbagliare di poco sposta al piu' di una fascia di spedizione (8,99 / 14,99 €). Controllare il peso reale sui primi colli
-- e correggere con un update. Da chiedere comunque a GES: quale bruciatore ha FRN01, se la cartuccia nella foto di FRN1405 e' inclusa.
begin;

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category, gtin)
select v.slug, (select id from categories where path = v.cat_path), v.name, v.description, v.price_cents, v.image_url, 0, true, null, v.weight_kg, v.dimensions_cm, v.gcat, v.gtin
from (values
  ('cda-0205-grill-butano-cartucce-227-g', 'campeggio.cucina-campeggio', 'Grill a butano per cartucce da 227 g',
   'Griglia a gas con piastra di cottura antiaderente e bruciatore in acciaio inox da 1,9 kW (cod. FRN03). Ha la regolazione della fiamma e l''accensione piezo. Funziona con cartucce di butano da 227 g, non incluse. Comprende una sacca in plastica per il trasporto.',
   11599, 'images/prodotti/cda-0205-grill-butano-cartucce-227-g.jpg', 3.0::numeric, '45x28x15', 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Outdoor Grills', '8008004122560'),
  ('cda-0207-barbecue-pieghevole', 'campeggio.cucina-campeggio', 'Barbecue pieghevole a carbonella',
   'Barbecue a carbonella richiudibile in acciaio, con paratia antivento e gambe removibili: si ripone in poco spazio quando non si usa (cod. BBQ01). Dimensioni totali 36 x 31 x 45 cm.',
   2399, 'images/prodotti/cda-0207-barbecue-pieghevole.jpg', 3.0, '36x31x45', 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Outdoor Grills', null),
  ('cda-0208-sedia-ombrello-deluxe-2', 'campeggio.tavoli-sedie', 'Sedia ombrello Deluxe 2',
   'Sedia pieghevole tipo ombrello con ampia seduta, imbottita da un sottile strato di gommapiuma nel tessuto (cod. SED111). La struttura tubolare robusta e il sedile largo la rendono stabile. Si ripiega in pochi secondi e si porta con la custodia in dotazione. Dimensioni totali 60 x 88 x 110 cm, da piegata 18 x 18 x 102 cm.',
   5799, 'images/prodotti/cda-0208-sedia-ombrello-deluxe-2.jpg', 3.0, '18x18x102', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs', null),
  ('cda-0209-sedia-pieghevole-52x52', 'campeggio.tavoli-sedie', 'Sedia pieghevole con portabevande',
   'Sedia pieghevole con robusto telaio in metallo, ampio schienale, seduta larga e braccioli con portabevande (cod. SED110). Si ripiega in pochi secondi. Dimensioni da aperta 52 x 52 x 68 cm, altezza della seduta da terra 30 cm.',
   2599, 'images/prodotti/cda-0209-sedia-pieghevole-52x52.jpg', 3.0, '52x52x68', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs', null),
  ('cda-0210-tavolino-multiuso', 'campeggio.accessori-campeggio', 'Tavolino multiuso pieghevole',
   'Tavolino pieghevole multifunzione per PC portatile, cibi e bevande, che si può appendere anche al volante (cod. TAV8515).',
   1999, 'images/prodotti/cda-0210-tavolino-multiuso.jpg', 1.2, '40x30x5', 'Furniture > Outdoor Furniture > Outdoor Tables', '8711293489312'),
  ('cda-0211-doccia-campeggio-pompetta-12v', 'campeggio.accessori-campeggio', 'Doccia da campeggio con pompa 12 V',
   'Doccetta con pompa a immersione 12 V per taniche e ghirbe, da collegare alla presa accendisigari (cod. DCC03). Portata 8 litri al minuto, tubo da 2 m. Comprende supporto con ventosa per fissare il doccino alla parete del camper, gancio multifit e sacca per il trasporto.',
   2599, 'images/prodotti/cda-0211-doccia-campeggio-pompetta-12v.jpg', 0.7, '25x15x10', 'Sporting Goods > Outdoor Recreation > Camping & Hiking > Portable Toilets & Showers > Portable Showers & Privacy Enclosures', null)
) as v(slug, cat_path, name, description, price_cents, image_url, weight_kg, dimensions_cm, gcat, gtin)
where not exists (select 1 from products p where p.slug = v.slug);

commit;

-- ===================== BLOCCO D: sedie, sdraio e tavoli da Euro Accessoires Italia =====================
-- Costo da area rivenditori EAI 15/10/2026 (listino IVA esclusa meno sconto); prezzo = listino x 1,22 - 0,01.
-- Costi: Ferio 31,50 | Ancona 45,78 | Barletta Cross 44,26 | Lettino 68,83 | Lago Cross 31,94 | Tavolo Barletta 71,31 |
--        Sorrento 80 68,85 | Sorrento 120 DG 106,55 | Sorrento 100 Miele 88,52.
-- Pesi: dalle schede EAI, tranne Lettino 6,0 kg e Lago Cross 3,5 kg che sono STIMATI (la scheda non li indica).
-- Foto: dal sito EAI (nessuna filigrana). Esclusi per ora: Sedia Lucca (scheda senza foto), Monaco (senza misure),
-- Tavolo Viamondo 4 posti (peso ignoto, margine 16 €), stuoie e tappeti (arrotolati 250 cm: spedizione "lungo" 32,99 €).
-- Nessuno supera 150 cm: tutti "normale". Soglia "lungo" assunta oltre 150 cm (nel catalogo il Mega Bag da 140 cm non e' lungo,
-- il pannello da 169,5 cm si'). Se la soglia scende, mettere long_package = true sui tavoli Sorrento 120.
begin;

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category)
select v.slug, (select id from categories where path = v.cat_path), v.name, v.description, v.price_cents, v.image_url, 0, true, v.brand, v.weight_kg, v.dimensions_cm, v.gcat
from (values
  ('cda-0212-poltroncina-pieghevole-ferio', 'campeggio.tavoli-sedie', 'Poltroncina pieghevole Ferio color lampone', null::text,
   'Poltroncina pieghevole da campeggio con tela in poliestere 600D, colore lampone. Dimensioni 101 x 64 x 72 cm, peso 4,3 kg.',
   5489, 'images/prodotti/cda-0212-poltroncina-pieghevole-ferio.jpg', 4.3::numeric, '101x64x72', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs'),
  ('cda-0213-sedia-ancona-comfort-grey', 'campeggio.tavoli-sedie', 'Sedia pieghevole Ancona Comfort grigia', 'Travellife',
   'Sedia pieghevole da campeggio Ancona Comfort, colore grigio. Il tessuto resiste all''acqua e ai raggi UV, si pulisce facilmente e asciuga in fretta. Dimensioni 100 x 64 x 10 cm, peso 5,5 kg.',
   9308, 'images/prodotti/cda-0213-sedia-ancona-comfort-grey.png', 5.5, '100x64x10', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs'),
  ('cda-0214-sedia-barletta-cross-antracite', 'campeggio.tavoli-sedie', 'Sedia pieghevole Barletta Cross antracite', 'Travellife',
   'Sedia pieghevole a croce con meccanismo di piegatura a fisarmonica: si chiude in dimensioni compatte di 93 x 28 x 22 cm. Lo schienale si regola in tre posizioni e l''imbottitura a nido d''ape ha delle aperture. Portata fino a 120 kg, peso 6 kg.',
   8999, 'images/prodotti/cda-0214-sedia-barletta-cross-antracite.png', 6, '93x28x22', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs'),
  ('cda-0215-lettino-blend-grey', 'campeggio.tavoli-sedie', 'Lettino pieghevole Blend Grey', 'Travellife',
   'Lettino pieghevole con telaio in alluminio e schienale regolabile, per rilassarsi e prendere il sole. Si ripiega in dimensioni compatte di 80 x 67 x 16 cm. Portata 110 kg.',
   13994, 'images/prodotti/cda-0215-lettino-blend-grey.png', 6, '80x67x16', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs'),
  ('cda-0216-sedia-lago-cross-grey', 'campeggio.tavoli-sedie', 'Sedia da campeggio Lago Cross grigia', 'Travellife',
   'Sedia da campeggio a croce in tessuto di poliestere imbottito, con schienale basso e chiuso che ripara la schiena dal vento. Il telaio in alluminio è leggero e la sedia si piega in dimensioni compatte, da riporre nella borsa per il trasporto inclusa. Dimensioni 45 x 63 x 86 cm, portata 120 kg.',
   5994, 'images/prodotti/cda-0216-sedia-lago-cross-grey.png', 3.5, '45x63x86', 'Furniture > Outdoor Furniture > Outdoor Seating > Outdoor Chairs'),
  ('cda-0217-tavolo-barletta-comfort-115', 'campeggio.tavoli-sedie', 'Tavolo da campeggio Barletta Comfort 115', 'Travellife',
   'Tavolo da campeggio con gambe regolabili in altezza da 63 a 83 cm grazie al sistema Smartlock, per livellare il piano anche su fondo instabile. Dimensioni 115 x 70 x 85 cm, peso 12,7 kg.',
   14499, 'images/prodotti/cda-0217-tavolo-barletta-comfort-115.png', 12.7, '115x70x85', 'Furniture > Outdoor Furniture > Outdoor Tables'),
  ('cda-0218-tavolo-sorrento-80-dark-grey', 'campeggio.tavoli-sedie', 'Tavolo pieghevole Sorrento 80 cm Dark Grey', 'Travellife',
   'Tavolo pieghevole da campeggio Sorrento da 80 cm, colore Dark Grey. Dimensioni da piegato 80 x 60 x 6,5 cm, peso 3,4 kg.',
   13999, 'images/prodotti/cda-0218-tavolo-sorrento-80-dark-grey.png', 3.4, '80x60x6.5', 'Furniture > Outdoor Furniture > Outdoor Tables'),
  ('cda-0219-tavolo-sorrento-120-dark-grey', 'campeggio.tavoli-sedie', 'Tavolo pieghevole Sorrento 120 cm Dark Grey', 'Travellife',
   'Tavolo pieghevole da campeggio Sorrento da 120 cm, colore Dark Grey. Dimensioni da piegato 120 x 80 x 6,5 cm, peso 5,1 kg.',
   19998, 'images/prodotti/cda-0219-tavolo-sorrento-120-dark-grey.png', 5.1, '120x80x6.5', 'Furniture > Outdoor Furniture > Outdoor Tables'),
  ('cda-0220-tavolo-sorrento-100-miele', 'campeggio.tavoli-sedie', 'Tavolo pieghevole Sorrento 100 cm Miele', 'Travellife',
   'Tavolo pieghevole da campeggio Sorrento da 100 cm, colore Miele. Dimensioni da piegato 100 x 70 x 6,5 cm, peso 4,2 kg.',
   17999, 'images/prodotti/cda-0220-tavolo-sorrento-100-miele.png', 4.2, '100x70x6.5', 'Furniture > Outdoor Furniture > Outdoor Tables')
) as v(slug, cat_path, name, brand, description, price_cents, image_url, weight_kg, dimensions_cm, gcat)
where not exists (select 1 from products p where p.slug = v.slug);

commit;

-- ===================== CONTROLLI DOPO L'ESECUZIONE =====================
-- select slug, active, price_cents, weight_kg, category_id is not null as con_categoria from products where slug ~ '^cda-(019[5-9]|020[0-9]|021[0-9]|0220)';
-- select path, depth, sort_order from categories where path like 'campeggio%' order by path;
