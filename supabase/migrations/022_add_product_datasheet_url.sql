-- Link a scheda tecnica/certificazione scaricabile (PDF), quando disponibile
-- dal fornitore. Mostrato sulla pagina prodotto solo se compilato (vedi
-- spec-datasheet-row in prodotto.html e initProductPage() in js/main.js).

alter table products add column if not exists datasheet_url text;
comment on column products.datasheet_url is 'Link a scheda tecnica/certificazione scaricabile (PDF), quando disponibile dal fornitore. Mostrato sulla pagina prodotto solo se compilato.';
