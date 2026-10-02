-- Stesso schema di sicurezza già usato per backup-database: le Edge
-- Function prepare-newsletter/send-newsletter non devono essere
-- raggiungibili da chiunque. Il codice segreto vero vive solo in
-- Supabase Vault (creato a parte con vault.create_secret, mai scritto
-- qui né nel codice sorgente); qui c'è solo la funzione che lo confronta.

create or replace function public.verify_newsletter_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_secret = (
    select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_cron_secret'
  );
$$;

revoke all on function public.verify_newsletter_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_newsletter_cron_secret(text) to service_role;

-- IMPORTANTE: il cron chiama solo prepare-newsletter, MAI send-newsletter.
-- prepare-newsletter sceglie i prodotti, salva una bozza in
-- newsletter_drafts e manda un'anteprima via email solo a chi gestisce
-- il sito (NOTIFY_EMAIL) — non tocca gli iscritti veri. send-newsletter
-- (che manda davvero agli iscritti) va chiamata SOLO a mano, dopo aver
-- letto la bozza e dato l'ok esplicito: mai automatica, per non ripetere
-- l'errore di aver mandato un invio di prova a un iscritto reale.
select cron.unschedule('send-monthly-newsletter')
where exists (select 1 from cron.job where jobname = 'send-monthly-newsletter');

select cron.unschedule('prepare-monthly-newsletter')
where exists (select 1 from cron.job where jobname = 'prepare-monthly-newsletter');

-- Il giorno 1 di ogni mese alle 9:00 — "non troppo spesso" come richiesto.
select cron.schedule(
  'prepare-monthly-newsletter',
  '0 9 1 * *',
  $$
  select net.http_post(
    url := 'https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/prepare-newsletter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
