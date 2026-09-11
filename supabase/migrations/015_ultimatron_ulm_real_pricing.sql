-- Prezzi reali per le 3 batterie Ultimatron ULM (12-200H, 12-310H, 12-620),
-- calcolati dal listino rivenditore reale (Listino prezzi concessionari
-- Ultimatron 3-IT.pdf): costo IVA esclusa +110% = prezzo pieno (IVA e
-- trasporto inclusi), poi -35% di sconto reale sul prezzo di vendita.
-- Sostituiscono i prezzi precedenti che erano stime, non basate sul
-- listino reale.

alter table public.products add column if not exists compare_at_price_cents integer;

update public.products
set price_cents = 86699, compare_at_price_cents = 133445
where slug = 'cda-0175-batteria-litio-ultimatron-ulm-12-200h';

update public.products
set price_cents = 128499, compare_at_price_cents = 197658
where slug = 'cda-0176-batteria-litio-ultimatron-ulm-12-310h';

insert into public.products (category_id, slug, name, description, price_cents, compare_at_price_cents, currency, image_url, stock, active, featured, brand, is_bundle)
values (
  '99f1e1b7-48cc-4bfd-a311-314187f92898',
  'cda-0177-batteria-litio-ultimatron-ulm-12-620',
  'Batteria Litio Ultimatron ULM-12-620 12,8V 620Ah',
  'Batteria al litio LiFePO4 Ultimatron ULM-12-620 da 12,8V e 620Ah (7.936Wh), massima capacità della gamma ULM in custodia metallica (440×375×318mm). BMS intelligente integrato e Bluetooth per il monitoraggio da app. Oltre 6.000 cicli all''80% di profondità di scarica, 5 anni di garanzia del produttore. Tensione di carica consigliata 14,6V: compatibile con caricabatterie, regolatori MPPT e inverter/caricabatterie Victron Energy.',
  236299,
  363548,
  'EUR',
  'images/prodotti/ultimatron-ulm-12-620.png',
  0,
  true,
  false,
  'Ultimatron',
  false
)
on conflict (slug) do nothing;
