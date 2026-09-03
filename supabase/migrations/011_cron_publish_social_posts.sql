-- Pianifica la Edge Function publish-scheduled-post una volta al giorno.
-- La funzione stessa decide se è davvero il momento di pubblicare (vedi
-- MIN_DAYS_BETWEEN_POSTS nel suo codice) — qui serve solo "controlla ogni
-- giorno", non "pubblica ogni giorno". Finché i secret Meta non sono
-- configurati, ogni esecuzione si ferma subito senza fare nulla.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('publish-social-post-daily')
where exists (select 1 from cron.job where jobname = 'publish-social-post-daily');

select cron.schedule(
  'publish-social-post-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/publish-scheduled-post',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
