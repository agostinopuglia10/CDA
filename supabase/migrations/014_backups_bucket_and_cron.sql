-- Bucket privato per gli snapshot settimanali del database (backup gratuito
-- fatto in proprio, visto che il piano Supabase attuale è "free" e non
-- include backup automatici affidabili). Nessuna policy pubblica: solo il
-- service role (usato dalla Edge Function) può leggerlo/scriverlo.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Pianifica il backup automatico settimanale (domenica alle 3:00),
-- stesso schema già usato per la pubblicazione dei post social.
select cron.unschedule('weekly-database-backup')
where exists (select 1 from cron.job where jobname = 'weekly-database-backup');

select cron.schedule(
  'weekly-database-backup',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := 'https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/backup-database',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
