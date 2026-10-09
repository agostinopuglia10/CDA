-- Bombola GPL Prakto con valvola automotive, pezzi di montaggio e kit,
-- per il post "impianti". Prezzi presi da GES International ("al pubblico",
-- IVA inclusa); costo fornitore ("prezzo operatori") tracciato in
-- prezzi-prodotti.csv, non nel DB (che non ha un campo costo).

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
values ('bombole-gpl', 'Bombole e Serbatoi GPL', 'Bombola GPL con valvola automotive per il rifornimento dal benzinaio, e tutti i pezzi per installarla e collegarla all''impianto del mezzo.', 3, '84071954-4c09-4409-a94f-08b7333747e2', 'clima.bombole-gpl', 2);

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, brand, weight_kg, dimensions_cm, google_product_category, datasheet_url) values
('cda-0180-bombola-gpl-prakto-valvola-automotive-26-3-l', 'b49b413d-031a-460d-b6d9-47d80c47b569', 'Bombola GPL Prakto • valvola automotive • 26,3 L',
'Bombola GPL Prakto da 26,3 L con valvola di sicurezza omologata automotive: si ricarica direttamente dal benzinaio, in totale sicurezza (il riempimento si ferma da solo all''80%, limite previsto dalla legge). Corpo in acciaio verniciato verde, il 30% più leggera delle bombole in ghisa, manico in alluminio removibile e manometro di precisione per leggere il livello di gas. Vita utile della bombola 10 anni, garanzia 2 anni. Il certificato di conformità e omologazione europea arriva a casa tua insieme alla bombola. Per collegarla all''impianto del mezzo serve l''adattatore dedicato, incluso nel Kit Bombola GPL + Montaggio qui sotto.',
44000, 'images/prodotti/cda-0180-bombola-gpl-prakto-valvola-automotive-26-3-l.jpeg', 0, true, 'Prakto', 13, '35x35x58',
'Veicoli e parti > Componenti e accessori per auto > Componenti per veicoli a motore > Sistemi di alimentazione per veicoli a motore',
'docs/certificazioni/bombola-gpl-prakto-scheda-tecnica.pdf'),

('cda-0181-staffe-bombola-prakto-26-3-l', 'b49b413d-031a-460d-b6d9-47d80c47b569', 'Staffe bombola Prakto • 26,3 L',
'Staffe strutturali per il montaggio sicuro della bombola GPL Prakto da 26,3 L nel vano di carico di camper, van o veicoli attrezzati: bloccano la bombola evitando movimenti, vibrazioni e disallineamenti durante la guida. Attualmente disponibili su richiesta dal fornitore, con circa 14 giorni di attesa.',
26000, 'images/prodotti/cda-0181-staffe-bombola-prakto-26-3-l.jpeg', 0, true, 'Prakto', null, null,
'Veicoli e parti > Componenti e accessori per auto > Componenti per veicoli a motore > Sistemi di alimentazione per veicoli a motore', null),

('cda-0182-kit-riempimento-eur-maxi-s6', 'b49b413d-031a-460d-b6d9-47d80c47b569', 'Kit di riempimento EUR Maxi S6',
'Kit di riempimento indispensabile per il rifornimento diretto sulla bombola GPL Prakto, anche durante i viaggi in Europa: prolunga da 10 cm con valvola di non ritorno, raccordo curvo, e adattatori per Italia/Francia, Spagna, ACME e a baionetta.',
11000, 'images/prodotti/cda-0182-kit-riempimento-eur-maxi-s6.jpeg', 0, true, 'Prakto', null, null,
'Veicoli e parti > Componenti e accessori per auto > Componenti per veicoli a motore > Sistemi di alimentazione per veicoli a motore', null),

('cda-0183-raccordo-gas-italia-germania', 'b49b413d-031a-460d-b6d9-47d80c47b569', 'Raccordo gas M Italia/F Germania',
'Raccordo gas (maschio Italia - femmina Germania) indispensabile per collegare la bombola GPL Prakto ai regolatori di pressione con manichette italiane.',
600, 'images/prodotti/cda-0183-raccordo-gas-italia-germania.jpeg', 0, true, null, null, null,
'Veicoli e parti > Componenti e accessori per auto > Componenti per veicoli a motore > Sistemi di alimentazione per veicoli a motore', null);

insert into products (slug, category_id, name, description, price_cents, image_url, stock, active, is_bundle, brand, google_product_category, datasheet_url) values
('cda-bundle-0007-kit-bombola-gpl-automotive-montaggio', 'b49b413d-031a-460d-b6d9-47d80c47b569', 'Kit Bombola GPL Automotive + Montaggio',
'Tutto il necessario per installare la bombola GPL Prakto sul tuo mezzo: bombola con valvola automotive, staffe di fissaggio, kit di riempimento e raccordo per i regolatori italiani. Componenti compatibili tra loro, pronti per l''installazione nel nostro centro tecnico.',
73499, 'images/prodotti/cda-bundle-0007-kit-bombola-gpl-automotive-montaggio.jpg', 0, true, true, 'Prakto',
'Veicoli e parti > Componenti e accessori per auto > Componenti per veicoli a motore > Sistemi di alimentazione per veicoli a motore',
'docs/certificazioni/bombola-gpl-prakto-scheda-tecnica.pdf');

insert into bundle_items (bundle_id, component_product_id, quantity)
select b.id, c.id, 1
from products b, products c
where b.slug = 'cda-bundle-0007-kit-bombola-gpl-automotive-montaggio'
and c.slug in (
  'cda-0180-bombola-gpl-prakto-valvola-automotive-26-3-l',
  'cda-0181-staffe-bombola-prakto-26-3-l',
  'cda-0182-kit-riempimento-eur-maxi-s6',
  'cda-0183-raccordo-gas-italia-germania'
);
