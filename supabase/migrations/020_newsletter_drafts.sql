-- Bozze della newsletter mensile: prepare-newsletter sceglie i prodotti
-- e li salva qui, così send-newsletter (chiamata solo a mano dopo l'ok)
-- invia esattamente quello che è stato mostrato in anteprima, non una
-- nuova selezione casuale.
create table if not exists public.newsletter_drafts (
  id uuid primary key default gen_random_uuid(),
  product_ids uuid[] not null,
  month_label text not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz
);

alter table public.newsletter_drafts enable row level security;
-- nessuna policy pubblica: la tabella è gestita solo dalle Edge Function
-- (service role), mai letta/scritta dal sito o da utenti anonimi.
