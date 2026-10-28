-- Foto aggiuntive dei prodotti (seconda, terza foto...), per Google Merchant Center:
-- "Qualità del negozio > Immagini per offerta" risulta "Incompleto" perché ogni prodotto
-- nel feed ha una sola foto (image_url). La product-feed le manda come g:additional_image_link
-- (massimo 10). Percorsi relativi (images/prodotti/...) o URL assoluti, come image_url.
alter table public.products
  add column if not exists additional_image_urls text[] not null default '{}';
