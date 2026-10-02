-- Aggiunge la possibilità di disiscriversi dalla newsletter: ogni iscritto
-- ha un token univoco (non indovinabile) usato nel link di cancellazione
-- dentro ogni email, senza bisogno di login. unsubscribed_at NULL = ancora
-- iscritto; valorizzato = non riceve più nulla, ma la riga resta per non
-- perdere lo storico iscrizioni.

alter table public.newsletter_signups
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz;

create unique index if not exists newsletter_signups_unsubscribe_token_key
  on public.newsletter_signups (unsubscribe_token);
