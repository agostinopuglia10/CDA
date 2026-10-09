-- Aggiunge il codice a barre (EAN/UPC) prodotto, quando noto dal fornitore.
-- Usato dal feed Google Shopping (product-feed) per evitare identifier_exists=no
-- sui prodotti di marca nota (Dometic, Truma, Thetford, ecc.), dove Google
-- Merchant si aspetta un identificativo univoco.

alter table products add column if not exists gtin text;
comment on column products.gtin is 'Codice a barre (EAN/UPC) del prodotto, quando noto dal fornitore. Usato nel feed Google Shopping per identifier_exists.';

update products set gtin = '8055323211277' where slug = 'telecamera-18ir-motorhome-970060';
update products set gtin = '8059174956882' where slug = 'lampada-notturna-emergenza-lipo-930475';
